package delivery

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
)

const africasTalkingBaseURL = "https://api.africastalking.com"

// AfricasTalkingAdapter sends SMS; it is disabled when AT_USERNAME or AT_API_KEY is unset.
// The request shape follows the public bulk SMS API and has not been run against the live service.
type AfricasTalkingAdapter struct {
	username string
	apiKey   string
	senderID string
	baseURL  string
	client   *http.Client
}

// NewAfricasTalkingFromEnv reads AT_USERNAME, AT_API_KEY and the optional AT_SENDER_ID.
func NewAfricasTalkingFromEnv() *AfricasTalkingAdapter {
	return &AfricasTalkingAdapter{
		username: os.Getenv("AT_USERNAME"), apiKey: os.Getenv("AT_API_KEY"), senderID: os.Getenv("AT_SENDER_ID"),
		baseURL: africasTalkingBaseURL, client: &http.Client{Timeout: providerHTTPLimit},
	}
}

// Enabled reports whether credentials are present.
func (a *AfricasTalkingAdapter) Enabled() bool { return a.username != "" && a.apiKey != "" }

// Send posts one SMS and returns the provider message id.
func (a *AfricasTalkingAdapter) Send(ctx context.Context, msg Message) (string, error) {
	if !a.Enabled() {
		return "", ErrDisabled
	}
	if msg.Phone == "" {
		return "", ErrNoAddress
	}
	form := url.Values{"username": {a.username}, "to": {msg.Phone}, "message": {msg.Title + ": " + msg.Body}}
	if a.senderID != "" {
		form.Set("from", a.senderID)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/version1/messaging", strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("build sms request: %w", err)
	}
	req.Header.Set("apiKey", a.apiKey)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := a.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("sms request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("africastalking returned status %d", resp.StatusCode)
	}
	var out struct {
		SMSMessageData struct {
			Recipients []struct {
				StatusCode int    `json:"statusCode"`
				MessageID  string `json:"messageId"`
				Status     string `json:"status"`
			} `json:"Recipients"`
		} `json:"SMSMessageData"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil || len(out.SMSMessageData.Recipients) == 0 {
		return "", fmt.Errorf("africastalking response has no recipients")
	}
	rec := out.SMSMessageData.Recipients[0]
	// 100-102 are the accepted codes; anything else is a rejection
	if rec.StatusCode < 100 || rec.StatusCode > 102 {
		return "", fmt.Errorf("africastalking rejected sms: %s", rec.Status)
	}
	return rec.MessageID, nil
}
