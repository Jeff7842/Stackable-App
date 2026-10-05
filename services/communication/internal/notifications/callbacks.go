package notifications

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	kit "github.com/stackable/go-kit"
)

// SignatureVerifier checks that a provider callback really came from the provider.
type SignatureVerifier interface {
	Verify(provider string, headers map[string]string, body []byte) error
}

// FakeVerifier accepts every callback unless Reject is set; it is for dev and tests only.
type FakeVerifier struct{ Reject bool }

// Verify implements SignatureVerifier.
func (f FakeVerifier) Verify(string, map[string]string, []byte) error {
	if f.Reject {
		return errors.New("signature rejected")
	}
	return nil
}

// parsers turn each provider's callback body into a CallbackEvent; an empty status means "not a final report".
// Headers are lower-cased by the handler.
var parsers = map[string]func(headers map[string]string, body []byte) (CallbackEvent, error){
	"fake":          parseFake,
	"resend":        parseResend,
	"africastalking": parseAfricasTalking,
}

func parseFake(_ map[string]string, body []byte) (CallbackEvent, error) {
	var p struct {
		ID          string `json:"id"`
		ProviderRef string `json:"providerRef"`
		Status      string `json:"status"`
	}
	if err := json.Unmarshal(body, &p); err != nil {
		return CallbackEvent{}, err
	}
	return CallbackEvent{EventID: p.ID, ProviderRef: p.ProviderRef, Status: p.Status}, nil
}

// parseResend maps Resend webhook types; the event id is the svix-id header Resend sends.
func parseResend(headers map[string]string, body []byte) (CallbackEvent, error) {
	var p struct {
		Type string `json:"type"`
		Data struct {
			EmailID string `json:"email_id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &p); err != nil {
		return CallbackEvent{}, err
	}
	status := ""
	switch p.Type {
	case "email.delivered":
		status = StatusDelivered
	case "email.bounced", "email.failed", "email.complained":
		status = StatusFailed
	}
	return CallbackEvent{EventID: headers["svix-id"], ProviderRef: p.Data.EmailID, Status: status}, nil
}

// parseAfricasTalking maps the delivery report fields of Africa's Talking.
func parseAfricasTalking(_ map[string]string, body []byte) (CallbackEvent, error) {
	var p struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(body, &p); err != nil {
		return CallbackEvent{}, err
	}
	status := ""
	switch strings.ToLower(p.Status) {
	case "success":
		status = StatusDelivered
	case "failed", "rejected", "absentsubscriber":
		status = StatusFailed
	}
	return CallbackEvent{EventID: p.ID, ProviderRef: p.ID, Status: status}, nil
}

// RecordCallback stores one provider delivery report.
// It exists so providers can retry the same callback safely; repeats change nothing.
func (s *Service) RecordCallback(ctx context.Context, provider string, headers map[string]string, body []byte) (CallbackOutcome, error) {
	parse, ok := parsers[provider]
	if !ok {
		return CallbackOutcome{}, kit.NotFound("Unknown provider.")
	}
	ev, err := parse(headers, body)
	if err != nil {
		return CallbackOutcome{}, kit.Validation("Callback body is not valid for this provider.", nil)
	}
	ev.Provider, ev.Payload = provider, body
	if ev.EventID == "" || ev.ProviderRef == "" {
		return CallbackOutcome{}, kit.Validation("Callback has no event id or provider reference.", nil)
	}
	if ev.Status != StatusDelivered && ev.Status != StatusFailed {
		return CallbackOutcome{}, nil // progress reports such as "sent" carry nothing to store
	}
	out, err := s.store.RecordCallback(ctx, ev)
	if err != nil {
		return CallbackOutcome{}, fmt.Errorf("record callback: %w", err)
	}
	return out, nil
}
