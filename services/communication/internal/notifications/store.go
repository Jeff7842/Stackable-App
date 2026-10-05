package notifications

import (
	"context"
	"time"
)

// Store persists notifications. Every method is scoped by school id except ClaimQueued and RecordCallback.
// Those two run for the whole service because the worker and provider callbacks carry no school token.
type Store interface {
	// CreateNotification returns the stored row and false when the idempotency key already existed.
	CreateNotification(ctx context.Context, n NewNotification) (Notification, bool, error)
	// ListInbox returns up to limit items newest first, after the cursor when given.
	ListInbox(ctx context.Context, schoolID, userID string, limit int, after *Cursor) ([]InboxItem, error)
	// MarkRead is idempotent and returns ErrNotFound when the user is not a recipient.
	MarkRead(ctx context.Context, schoolID, userID, notificationID string) error
	ListPreferences(ctx context.Context, schoolID, userID string) ([]Preference, error)
	// FindPreference returns the row for the type, else the AnyType row, else nil.
	FindPreference(ctx context.Context, schoolID, userID, notifType string) (*Preference, error)
	// SavePreferences upserts the given types and leaves other types untouched.
	SavePreferences(ctx context.Context, schoolID, userID string, prefs []Preference) error
	// DeliveryCounts returns a count for every status, or ErrNotFound.
	DeliveryCounts(ctx context.Context, schoolID, notificationID string) (map[string]int, error)
	// ClaimQueued leases up to limit QUEUED deliveries so two workers never send the same one.
	ClaimQueued(ctx context.Context, limit int, lease time.Duration) ([]Job, error)
	// ReleaseDelivery gives a claimed delivery back to the queue untouched.
	ReleaseDelivery(ctx context.Context, schoolID, deliveryID string) error
	// FinishDelivery writes the result and, for UNDELIVERED, the outbox row in the same transaction.
	FinishDelivery(ctx context.Context, schoolID, deliveryID string, res Result) error
	// RecordCallback stores a provider report once per (provider, event id) and updates the delivery it names.
	RecordCallback(ctx context.Context, ev CallbackEvent) (CallbackOutcome, error)
}
