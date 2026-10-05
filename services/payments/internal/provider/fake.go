package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// Phone numbers that make the fake provider fail at initiation, so demos and tests can trigger each path.
const (
	FakePhoneTimeout  = "254700000003"
	FakePhoneRailDown = "254700000005"
)

// Fake is a deterministic provider for tests and demos; it never calls a network.
type Fake struct{}

// Name returns the webhook path segment and rail name.
func (Fake) Name() string { return "fake" }

// Initiate derives the transaction id from the payment id so repeats are stable.
func (Fake) Initiate(_ context.Context, p Payment) (Ref, error) {
	switch p.PayerPhone {
	case FakePhoneTimeout:
		return Ref{}, &Error{Code: Timeout, Message: "fake provider timed out"}
	case FakePhoneRailDown:
		return Ref{}, &Error{Code: RailDown, Message: "fake provider is down"}
	}
	return Ref{TransactionID: "fake_" + p.ID}, nil
}

type fakeWebhook struct {
	ID            string `json:"id"`
	TransactionID string `json:"transactionId"`
	Status        string `json:"status"`
	FailureCode   string `json:"failureCode"`
	AmountMinor   int64  `json:"amountMinor"`
	SchoolID      string `json:"schoolId"`
	StudentID     string `json:"studentId"`
}

// VerifyWebhook parses the fake JSON shape; a missing status means success.
func (Fake) VerifyWebhook(_ http.Header, body []byte) (Event, error) {
	var w fakeWebhook
	if err := json.Unmarshal(body, &w); err != nil || w.ID == "" {
		return Event{}, fmt.Errorf("%w: fake webhook needs a JSON object with an id", ErrInvalidWebhook)
	}
	if w.AmountMinor < 0 {
		return Event{}, fmt.Errorf("%w: negative amount", ErrInvalidWebhook)
	}
	ev := Event{
		EventID: w.ID, TransactionID: w.TransactionID, Succeeded: w.Status == "" || w.Status == "success",
		AmountMinor: w.AmountMinor, SchoolHint: w.SchoolID, StudentHint: w.StudentID,
	}
	if ev.TransactionID == "" {
		ev.TransactionID = w.ID
	}
	if !ev.Succeeded {
		ev.FailureCode = FailureCode(w.FailureCode)
		if ev.FailureCode == "" {
			ev.FailureCode = RailDown
		}
	}
	return ev, nil
}

// Refund always succeeds because no money moves.
func (Fake) Refund(context.Context, Payment) error { return nil }
