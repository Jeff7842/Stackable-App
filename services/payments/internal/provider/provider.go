// Package provider hides each payment rail (M-Pesa, fake, later card and bank) behind one interface.
package provider

import (
	"context"
	"errors"
	"net/http"
)

// FailureCode is the rail-neutral reason a payment attempt failed.
type FailureCode string

const (
	InsufficientFunds FailureCode = "INSUFFICIENT_FUNDS"
	WrongPin          FailureCode = "WRONG_PIN"
	Timeout           FailureCode = "TIMEOUT"
	UserCancelled     FailureCode = "USER_CANCELLED"
	RailDown          FailureCode = "RAIL_DOWN"
)

// Error is a provider failure with one of the stable codes.
type Error struct {
	Code    FailureCode
	Message string
}

func (e *Error) Error() string { return string(e.Code) + ": " + e.Message }

var (
	// ErrInvalidWebhook means the body is not a valid callback for this provider.
	ErrInvalidWebhook = errors.New("invalid webhook")
	// ErrBadSignature means the callback failed authenticity checks.
	ErrBadSignature = errors.New("bad webhook signature")
	// ErrInvalidRequest means the payment cannot be sent to this rail as given.
	ErrInvalidRequest = errors.New("invalid payment request")
	// ErrNotSupported means the rail does not offer this operation yet.
	ErrNotSupported = errors.New("operation not supported by provider")
)

// Payment is the part of a payment a rail needs to start a charge.
type Payment struct {
	ID          string
	AmountMinor int64
	PayerPhone  string
	Reference   string
}

// Ref identifies the charge on the provider side.
type Ref struct {
	TransactionID string
}

// Event is a verified provider callback in rail-neutral form.
type Event struct {
	EventID       string
	TransactionID string
	Succeeded     bool
	FailureCode   FailureCode
	AmountMinor   int64 // zero when the callback does not state an amount
	SchoolHint    string
	StudentHint   string
}

// PaymentProvider is the only way the service talks to a payment rail.
type PaymentProvider interface {
	Name() string
	Initiate(ctx context.Context, p Payment) (Ref, error)
	VerifyWebhook(headers http.Header, body []byte) (Event, error)
	Refund(ctx context.Context, p Payment) error
}
