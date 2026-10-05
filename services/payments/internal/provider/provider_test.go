package provider

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const successCallback = `{"Body":{"stkCallback":{"MerchantRequestID":"29115-34620561-1","CheckoutRequestID":"ws_CO_191220191020363925","ResultCode":0,"ResultDesc":"The service request is processed successfully.","CallbackMetadata":{"Item":[{"Name":"Amount","Value":1.00},{"Name":"MpesaReceiptNumber","Value":"NLJ7RT61SV"},{"Name":"TransactionDate","Value":20191219102115},{"Name":"PhoneNumber","Value":254708374149}]}}}}`

func failureCallback(code int) string {
	return `{"Body":{"stkCallback":{"MerchantRequestID":"m","CheckoutRequestID":"ws_CO_1","ResultCode":` + itoa(code) + `,"ResultDesc":"x"}}}`
}

func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}

func TestDarajaSuccessCallbackIsParsed(t *testing.T) {
	ev, err := (&Mpesa{}).VerifyWebhook(nil, []byte(successCallback))
	if err != nil {
		t.Fatal(err)
	}
	if !ev.Succeeded || ev.TransactionID != "ws_CO_191220191020363925" || ev.EventID != ev.TransactionID || ev.AmountMinor != 100 {
		t.Fatalf("event %+v", ev)
	}
}

func TestDarajaFailureCodesMapToDistinctCodes(t *testing.T) {
	cases := map[int]FailureCode{
		1: InsufficientFunds, 2001: WrongPin, 1032: UserCancelled, 1037: Timeout, 1019: Timeout, 9999: RailDown,
	}
	for code, want := range cases {
		ev, err := (&Mpesa{}).VerifyWebhook(nil, []byte(failureCallback(code)))
		if err != nil || ev.Succeeded || ev.FailureCode != want {
			t.Fatalf("code %d: got %+v err %v, want %s", code, ev, err, want)
		}
	}
}

func TestDarajaRejectsMalformedCallbacks(t *testing.T) {
	for name, body := range map[string]string{
		"not json":        `nope`,
		"no checkout id":  `{"Body":{"stkCallback":{"ResultCode":0}}}`,
		"empty object":    `{}`,
		"bad amount type": `{"Body":{"stkCallback":{"CheckoutRequestID":"c","ResultCode":0,"CallbackMetadata":{"Item":[{"Name":"Amount","Value":{"x":1}}]}}}}`,
	} {
		if _, err := (&Mpesa{}).VerifyWebhook(nil, []byte(body)); !errors.Is(err, ErrInvalidWebhook) {
			t.Fatalf("%s: err %v", name, err)
		}
	}
}

func TestAmountAsStringWithDecimals(t *testing.T) {
	got, err := shillingsToMinor(json.RawMessage(`"1500.50"`))
	if err != nil || got != 150050 {
		t.Fatalf("got %d %v", got, err)
	}
}

func TestNormalizeKenyanPhone(t *testing.T) {
	for in, want := range map[string]string{
		"0712345678": "254712345678", "+254 712 345 678": "254712345678", "254112345678": "254112345678",
	} {
		if got, err := NormalizeKenyanPhone(in); err != nil || got != want {
			t.Fatalf("%s: got %s %v", in, got, err)
		}
	}
	for _, bad := range []string{"", "12345", "0712abc678", "255712345678"} {
		if _, err := NormalizeKenyanPhone(bad); !errors.Is(err, ErrInvalidRequest) {
			t.Fatalf("%q accepted", bad)
		}
	}
}

func darajaServer(t *testing.T, stkStatus int, stkBody string, seen *stkRequest) *Mpesa {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth/v1/generate":
			if !strings.HasPrefix(r.Header.Get("Authorization"), "Basic ") {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_, _ = w.Write([]byte(`{"access_token":"tok","expires_in":"3599"}`))
		case "/mpesa/stkpush/v1/processrequest":
			if r.Header.Get("Authorization") != "Bearer tok" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_ = json.NewDecoder(r.Body).Decode(seen)
			w.WriteHeader(stkStatus)
			_, _ = w.Write([]byte(stkBody))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return NewMpesa(MpesaConfig{ConsumerKey: "k", ConsumerSecret: "s", Shortcode: "174379", Passkey: "pk", CallbackURL: "https://x/cb", BaseURL: srv.URL}, srv.Client())
}

func TestMpesaInitiateSendsStkPush(t *testing.T) {
	var seen stkRequest
	m := darajaServer(t, 200, `{"MerchantRequestID":"m","CheckoutRequestID":"ws_CO_9","ResponseCode":"0","ResponseDescription":"ok"}`, &seen)
	ref, err := m.Initiate(context.Background(), Payment{ID: "p1", AmountMinor: 250000, PayerPhone: "0712345678", Reference: "p1"})
	if err != nil || ref.TransactionID != "ws_CO_9" {
		t.Fatalf("ref %+v err %v", ref, err)
	}
	if seen.Amount != 2500 || seen.PhoneNumber != "254712345678" || seen.BusinessShortCode != "174379" || seen.CallBackURL != "https://x/cb" || seen.Password == "" {
		t.Fatalf("request %+v", seen)
	}
}

func TestMpesaInitiateMapsRailFailures(t *testing.T) {
	var seen stkRequest
	down := darajaServer(t, 503, `{}`, &seen)
	_, err := down.Initiate(context.Background(), Payment{ID: "p", AmountMinor: 100, PayerPhone: "0712345678"})
	var pe *Error
	if !errors.As(err, &pe) || pe.Code != RailDown {
		t.Fatalf("err %v", err)
	}
	rejected := darajaServer(t, 400, `{"errorCode":"400.002.02","errorMessage":"Bad Request"}`, &seen)
	_, err = rejected.Initiate(context.Background(), Payment{ID: "p", AmountMinor: 100, PayerPhone: "0712345678"})
	if !errors.As(err, &pe) || pe.Code != RailDown {
		t.Fatalf("err %v", err)
	}
}

func TestMpesaInitiateTimeoutIsTimeout(t *testing.T) {
	m := darajaServer(t, 200, `{}`, &stkRequest{})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := m.Initiate(ctx, Payment{ID: "p", AmountMinor: 100, PayerPhone: "0712345678"})
	var pe *Error
	if !errors.As(err, &pe) || (pe.Code != RailDown && pe.Code != Timeout) {
		t.Fatalf("err %v", err)
	}
}

func TestMpesaRejectsFractionalShillings(t *testing.T) {
	m := darajaServer(t, 200, `{}`, &stkRequest{})
	_, err := m.Initiate(context.Background(), Payment{ID: "p", AmountMinor: 150, PayerPhone: "0712345678"})
	if !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("err %v", err)
	}
}

func TestMpesaDisabledWithoutEnv(t *testing.T) {
	for _, k := range []string{"MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY", "MPESA_CALLBACK_URL"} {
		t.Setenv(k, "")
	}
	if _, ok := NewMpesaFromEnv(); ok {
		t.Fatal("mpesa enabled with no config")
	}
	t.Setenv("MPESA_CONSUMER_KEY", "k")
	t.Setenv("MPESA_CONSUMER_SECRET", "s")
	t.Setenv("MPESA_SHORTCODE", "1")
	t.Setenv("MPESA_PASSKEY", "p")
	t.Setenv("MPESA_CALLBACK_URL", "https://x")
	if _, ok := NewMpesaFromEnv(); !ok {
		t.Fatal("mpesa disabled with full config")
	}
}

func TestMpesaRefundNotSupported(t *testing.T) {
	if err := (&Mpesa{}).Refund(context.Background(), Payment{}); !errors.Is(err, ErrNotSupported) {
		t.Fatalf("err %v", err)
	}
}

func TestFakeProvider(t *testing.T) {
	f := Fake{}
	ref, err := f.Initiate(context.Background(), Payment{ID: "p1"})
	if err != nil || ref.TransactionID != "fake_p1" {
		t.Fatalf("%+v %v", ref, err)
	}
	for phone, want := range map[string]FailureCode{FakePhoneTimeout: Timeout, FakePhoneRailDown: RailDown} {
		_, err := f.Initiate(context.Background(), Payment{ID: "p", PayerPhone: phone})
		var pe *Error
		if !errors.As(err, &pe) || pe.Code != want {
			t.Fatalf("%s: %v", phone, err)
		}
	}
	ev, err := f.VerifyWebhook(nil, []byte(`{"id":"e1","transactionId":"fake_p1","status":"failed","failureCode":"WRONG_PIN"}`))
	if err != nil || ev.Succeeded || ev.FailureCode != WrongPin || ev.TransactionID != "fake_p1" {
		t.Fatalf("%+v %v", ev, err)
	}
	if _, err := f.VerifyWebhook(nil, []byte(`{"amountMinor":5}`)); !errors.Is(err, ErrInvalidWebhook) {
		t.Fatalf("err %v", err)
	}
}
