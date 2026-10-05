package provider

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	sandboxBaseURL    = "https://sandbox.safaricom.co.ke"
	mpesaHTTPTimeout  = 15 * time.Second
	tokenSafetyMargin = 30 * time.Second // refresh the OAuth token before it really expires
	minorPerShilling  = 100
	maxDarajaReply    = 1 << 20 // 1 MiB cap so a bad reply cannot exhaust memory
)

// Daraja ResultCode values from the STK callback that map to our failure codes.
const (
	resultSuccess           = 0
	resultInsufficientFunds = 1
	resultWrongPin          = 2001
	resultUserCancelled     = 1032
	resultTimeout           = 1037
	resultPromptExpired     = 1019
)

// MpesaConfig holds the Daraja credentials; BaseURL defaults to the sandbox.
type MpesaConfig struct {
	ConsumerKey    string
	ConsumerSecret string
	Shortcode      string
	Passkey        string
	CallbackURL    string
	BaseURL        string
}

// Mpesa is the Daraja STK-push provider (sandbox shape).
type Mpesa struct {
	cfg    MpesaConfig
	client *http.Client
	now    func() time.Time

	mu       sync.Mutex
	token    string
	tokenExp time.Time
}

// NewMpesaFromEnv returns false when any MPESA_* variable is unset, which disables the rail.
func NewMpesaFromEnv() (*Mpesa, bool) {
	cfg := MpesaConfig{
		ConsumerKey:    os.Getenv("MPESA_CONSUMER_KEY"),
		ConsumerSecret: os.Getenv("MPESA_CONSUMER_SECRET"),
		Shortcode:      os.Getenv("MPESA_SHORTCODE"),
		Passkey:        os.Getenv("MPESA_PASSKEY"),
		CallbackURL:    os.Getenv("MPESA_CALLBACK_URL"),
		BaseURL:        os.Getenv("MPESA_BASE_URL"),
	}
	if cfg.ConsumerKey == "" || cfg.ConsumerSecret == "" || cfg.Shortcode == "" || cfg.Passkey == "" || cfg.CallbackURL == "" {
		return nil, false
	}
	return NewMpesa(cfg, &http.Client{Timeout: mpesaHTTPTimeout}), true
}

// NewMpesa builds the provider; tests pass a client that points at a local server.
func NewMpesa(cfg MpesaConfig, client *http.Client) *Mpesa {
	if cfg.BaseURL == "" {
		cfg.BaseURL = sandboxBaseURL
	}
	return &Mpesa{cfg: cfg, client: client, now: time.Now}
}

// Name returns the webhook path segment and rail name.
func (*Mpesa) Name() string { return "mpesa" }

// NormalizeKenyanPhone turns 07.., 01.., +254.. or 254.. into 254XXXXXXXXX.
func NormalizeKenyanPhone(raw string) (string, error) {
	s := strings.NewReplacer(" ", "", "-", "", "+", "").Replace(raw)
	if strings.HasPrefix(s, "0") {
		s = "254" + s[1:]
	}
	if len(s) != 12 || !strings.HasPrefix(s, "254") {
		return "", fmt.Errorf("%w: phone must be a Kenyan number", ErrInvalidRequest)
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return "", fmt.Errorf("%w: phone must be digits only", ErrInvalidRequest)
		}
	}
	return s, nil
}

type stkRequest struct {
	BusinessShortCode string
	Password          string
	Timestamp         string
	TransactionType   string
	Amount            int64
	PartyA            string
	PartyB            string
	PhoneNumber       string
	CallBackURL       string
	AccountReference  string
	TransactionDesc   string
}

type stkResponse struct {
	MerchantRequestID   string `json:"MerchantRequestID"`
	CheckoutRequestID   string `json:"CheckoutRequestID"`
	ResponseCode        string `json:"ResponseCode"`
	ResponseDescription string `json:"ResponseDescription"`
	ErrorCode           string `json:"errorCode"`
	ErrorMessage        string `json:"errorMessage"`
}

// Initiate sends an STK push and returns the CheckoutRequestID as the transaction id.
func (m *Mpesa) Initiate(ctx context.Context, p Payment) (Ref, error) {
	phone, err := NormalizeKenyanPhone(p.PayerPhone)
	if err != nil {
		return Ref{}, err
	}
	if p.AmountMinor <= 0 || p.AmountMinor%minorPerShilling != 0 {
		return Ref{}, fmt.Errorf("%w: M-Pesa takes whole shillings", ErrInvalidRequest)
	}
	token, err := m.accessToken(ctx)
	if err != nil {
		return Ref{}, err
	}
	stamp := m.now().UTC().Format("20060102150405")
	body, err := json.Marshal(stkRequest{
		BusinessShortCode: m.cfg.Shortcode,
		Password:          base64.StdEncoding.EncodeToString([]byte(m.cfg.Shortcode + m.cfg.Passkey + stamp)),
		Timestamp:         stamp,
		TransactionType:   "CustomerPayBillOnline",
		Amount:            p.AmountMinor / minorPerShilling,
		PartyA:            phone,
		PartyB:            m.cfg.Shortcode,
		PhoneNumber:       phone,
		CallBackURL:       m.cfg.CallbackURL,
		AccountReference:  p.Reference,
		TransactionDesc:   "School fees",
	})
	if err != nil {
		return Ref{}, fmt.Errorf("encode stk request: %w", err)
	}
	raw, status, err := m.do(ctx, http.MethodPost, "/mpesa/stkpush/v1/processrequest", bytes.NewReader(body), "Bearer "+token)
	if err != nil {
		return Ref{}, err
	}
	return parseSTKResponse(raw, status)
}

func parseSTKResponse(raw []byte, status int) (Ref, error) {
	if status >= http.StatusInternalServerError {
		return Ref{}, &Error{Code: RailDown, Message: "daraja is unavailable"}
	}
	var resp stkResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return Ref{}, &Error{Code: RailDown, Message: fmt.Sprintf("unreadable daraja reply (http %d)", status)}
	}
	if status != http.StatusOK || resp.ResponseCode != "0" || resp.CheckoutRequestID == "" {
		return Ref{}, &Error{Code: RailDown, Message: "daraja rejected the request: " + firstNonEmpty(resp.ErrorMessage, resp.ResponseDescription)}
	}
	return Ref{TransactionID: resp.CheckoutRequestID}, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return "no detail"
}

func (m *Mpesa) accessToken(ctx context.Context) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.token != "" && m.now().Before(m.tokenExp) {
		return m.token, nil
	}
	basic := base64.StdEncoding.EncodeToString([]byte(m.cfg.ConsumerKey + ":" + m.cfg.ConsumerSecret))
	raw, status, err := m.do(ctx, http.MethodGet, "/oauth/v1/generate?grant_type=client_credentials", nil, "Basic "+basic)
	if err != nil {
		return "", err
	}
	token, ttl, err := parseOAuthResponse(raw, status)
	if err != nil {
		return "", err
	}
	m.token = token
	m.tokenExp = m.now().Add(ttl - tokenSafetyMargin)
	return m.token, nil
}

func parseOAuthResponse(raw []byte, status int) (string, time.Duration, error) {
	var resp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   string `json:"expires_in"`
	}
	if status != http.StatusOK || json.Unmarshal(raw, &resp) != nil || resp.AccessToken == "" {
		return "", 0, &Error{Code: RailDown, Message: fmt.Sprintf("daraja oauth failed (http %d)", status)}
	}
	secs, err := strconv.Atoi(resp.ExpiresIn)
	if err != nil || secs <= 0 {
		secs = 3599 // Daraja documents one hour; use it when the field is missing
	}
	return resp.AccessToken, time.Duration(secs) * time.Second, nil
}

// do runs one request; timeouts and network failures become TIMEOUT and RAIL_DOWN.
func (m *Mpesa) do(ctx context.Context, method, path string, body io.Reader, auth string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(m.cfg.BaseURL, "/")+path, body)
	if err != nil {
		return nil, 0, fmt.Errorf("build daraja request: %w", err)
	}
	req.Header.Set("Authorization", auth)
	req.Header.Set("Content-Type", "application/json")
	resp, err := m.client.Do(req)
	if err != nil {
		var netErr net.Error
		if errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &netErr) && netErr.Timeout()) {
			return nil, 0, &Error{Code: Timeout, Message: "daraja did not answer in time"}
		}
		return nil, 0, &Error{Code: RailDown, Message: "daraja is unreachable"}
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxDarajaReply))
	if err != nil {
		return nil, 0, &Error{Code: RailDown, Message: "daraja reply was cut off"}
	}
	return raw, resp.StatusCode, nil
}

type stkCallback struct {
	Body struct {
		StkCallback struct {
			MerchantRequestID string `json:"MerchantRequestID"`
			CheckoutRequestID string `json:"CheckoutRequestID"`
			ResultCode        int    `json:"ResultCode"`
			ResultDesc        string `json:"ResultDesc"`
			CallbackMetadata  struct {
				Item []struct {
					Name  string          `json:"Name"`
					Value json.RawMessage `json:"Value"`
				} `json:"Item"`
			} `json:"CallbackMetadata"`
		} `json:"stkCallback"`
	} `json:"Body"`
}

// VerifyWebhook parses an STK callback. Daraja does not sign callbacks, so the service only
// trusts it for a payment it started, and the proxy should allowlist Safaricom IPs.
func (*Mpesa) VerifyWebhook(_ http.Header, body []byte) (Event, error) {
	var cb stkCallback
	if err := json.Unmarshal(body, &cb); err != nil {
		return Event{}, fmt.Errorf("%w: not an stk callback", ErrInvalidWebhook)
	}
	c := cb.Body.StkCallback
	if c.CheckoutRequestID == "" {
		return Event{}, fmt.Errorf("%w: missing CheckoutRequestID", ErrInvalidWebhook)
	}
	ev := Event{EventID: c.CheckoutRequestID, TransactionID: c.CheckoutRequestID, Succeeded: c.ResultCode == resultSuccess}
	if !ev.Succeeded {
		ev.FailureCode = failureForResultCode(c.ResultCode)
		return ev, nil
	}
	for _, item := range c.CallbackMetadata.Item {
		if item.Name != "Amount" {
			continue
		}
		minor, err := shillingsToMinor(item.Value)
		if err != nil {
			return Event{}, fmt.Errorf("%w: bad Amount", ErrInvalidWebhook)
		}
		ev.AmountMinor = minor
	}
	return ev, nil
}

func failureForResultCode(code int) FailureCode {
	switch code {
	case resultInsufficientFunds:
		return InsufficientFunds
	case resultWrongPin:
		return WrongPin
	case resultUserCancelled:
		return UserCancelled
	case resultTimeout, resultPromptExpired:
		return Timeout
	default:
		return RailDown
	}
}

// shillingsToMinor reads a JSON number or string such as 1 or "1.50".
func shillingsToMinor(raw json.RawMessage) (int64, error) {
	var n json.Number
	if err := json.Unmarshal(raw, &n); err != nil {
		var s string
		if err2 := json.Unmarshal(raw, &s); err2 != nil {
			return 0, err
		}
		n = json.Number(s)
	}
	f, err := strconv.ParseFloat(n.String(), 64)
	if err != nil || f < 0 || math.IsNaN(f) || math.IsInf(f, 0) {
		return 0, errors.New("bad amount")
	}
	return int64(math.Round(f * minorPerShilling)), nil
}

// Refund is not offered: Daraja reversals need the Reversal API and initiator credentials.
func (*Mpesa) Refund(context.Context, Payment) error { return ErrNotSupported }
