package delivery

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

const (
	resendBaseURL     = "https://api.resend.com"
	providerHTTPLimit = 10 * time.Second // a hung provider must not stall the worker
)

// ResendAdapter sends email through Resend; it is disabled when the key or sender is unset.
type ResendAdapter struct {
	apiKey  string
	from    string
	baseURL string
	client  *http.Client
}

// NewResendFromEnv reads RESEND_API_KEY and RESEND_FROM_EMAIL.
func NewResendFromEnv() *ResendAdapter {
	return &ResendAdapter{
		apiKey: os.Getenv("RESEND_API_KEY"), from: os.Getenv("RESEND_FROM_EMAIL"),
		baseURL: resendBaseURL, client: &http.Client{Timeout: providerHTTPLimit},
	}
}

// Enabled reports whether credentials are present.
func (a *ResendAdapter) Enabled() bool { return a.apiKey != "" && a.from != "" }

// Send posts one email and returns Resend's email id.
func (a *ResendAdapter) Send(ctx context.Context, msg Message) (string, error) {
	if !a.Enabled() {
		return "", ErrDisabled
	}
	if msg.Email == "" {
		return "", ErrNoAddress
	}
	body, err := json.Marshal(map[string]any{"from": a.from, "to": []string{msg.Email}, "subject": msg.Title, "text": msg.Body})
	if err != nil {
		return "", fmt.Errorf("marshal resend body: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/emails", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("build resend request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", msg.DeliveryID) // a retried send must not email the parent twice
	resp, err := a.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("resend request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("resend returned status %d", resp.StatusCode)
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil || out.ID == "" {
		return "", fmt.Errorf("resend response has no id")
	}
	return out.ID, nil
}
