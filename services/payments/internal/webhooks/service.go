package webhooks

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	kit "github.com/stackable/go-kit"
)

// extractors read the provider's own event id from its payload.
var extractors = map[string]func(map[string]any) string{
	"fake":     func(p map[string]any) string { return scalarString(p["id"]) },
	"paystack": func(p map[string]any) string { return scalarString(dig(p, "data", "id")) },
	"mpesa":    func(p map[string]any) string { return scalarString(dig(p, "Body", "stkCallback", "CheckoutRequestID")) },
}

func dig(m map[string]any, path ...string) any {
	var cur any = m
	for _, key := range path {
		next, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur = next[key]
	}
	return cur
}

func scalarString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	default:
		return ""
	}
}

// Service records webhook events. It knows nothing about HTTP.
type Service struct {
	store Store
}

// NewService builds a Service over a Store.
func NewService(store Store) *Service {
	return &Service{store: store}
}

// Receive stores a webhook once and reports whether it was a repeat.
// A repeat changes nothing, so providers can retry safely.
func (s *Service) Receive(ctx context.Context, provider string, payload json.RawMessage) (duplicate bool, err error) {
	extract, ok := extractors[provider]
	if !ok {
		return false, kit.NotFound("Unknown payment provider.")
	}
	var parsed map[string]any
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return false, kit.Validation("Webhook body must be a JSON object.", nil)
	}
	id := extract(parsed)
	if id == "" {
		return false, kit.Validation("Webhook has no event id.", map[string]string{"external_event_id": "missing"})
	}
	inserted, err := s.store.Insert(ctx, Event{Provider: provider, ExternalEventID: id, Payload: payload})
	if err != nil {
		return false, fmt.Errorf("store webhook: %w", err)
	}
	return !inserted, nil
}
