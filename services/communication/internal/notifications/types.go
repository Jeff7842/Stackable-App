package notifications

import (
	"errors"
	"time"
)

// Delivery channels in fallback order.
const (
	ChannelPush  = "push"
	ChannelSMS   = "sms"
	ChannelEmail = "email"
)

// Delivery statuses from the delivery state machine.
const (
	StatusQueued      = "QUEUED"
	StatusSent        = "SENT"
	StatusDelivered   = "DELIVERED"
	StatusFailed      = "FAILED"
	StatusUndelivered = "UNDELIVERED"
)

// TypeSafety notifications ignore quiet hours because a child's safety cannot wait for morning.
const TypeSafety = "safety"

// AnyType is the preference row that applies when no row exists for the notification's own type.
const AnyType = "*"

// ChannelOrder is the fallback order tried for every delivery.
var ChannelOrder = []string{ChannelPush, ChannelSMS, ChannelEmail}

// AllStatuses lists every delivery status so counts always include zeros.
var AllStatuses = []string{StatusQueued, StatusSent, StatusDelivered, StatusFailed, StatusUndelivered}

// ErrNotFound is returned by a Store when the row does not exist for that school.
var ErrNotFound = errors.New("not found")

// Notification is one message sent to many recipients.
type Notification struct {
	ID               string    `json:"id"`
	Type             string    `json:"type"`
	Title            string    `json:"title"`
	Body             string    `json:"body"`
	Urgent           bool      `json:"urgent"`
	SenderIdentityID *string   `json:"senderIdentityId"`
	IdempotencyKey   string    `json:"idempotencyKey"`
	CreatedAt        time.Time `json:"createdAt"`
}

// Recipient is one parent after deduplication, with the children the message is about.
type Recipient struct {
	UserID          string
	ChildIDs        []string
	ChannelsAllowed []string
	Email           string
	Phone           string
}

// NewNotification is what a Store persists in one transaction: the notification, its recipients and one QUEUED delivery each.
type NewNotification struct {
	Notification
	SchoolID   string
	Recipients []Recipient
}

// InboxItem is a notification as one recipient sees it.
type InboxItem struct {
	ID        string     `json:"id"`
	Type      string     `json:"type"`
	Title     string     `json:"title"`
	Body      string     `json:"body"`
	Urgent    bool       `json:"urgent"`
	ChildIDs  []string   `json:"childIds"`
	CreatedAt time.Time  `json:"createdAt"`
	ReadAt    *time.Time `json:"readAt"`
}

// Cursor is the keyset position after the last inbox item of a page.
type Cursor struct {
	CreatedAt time.Time
	ID        string
}

// Preference is a user's channel choice and quiet hours for one notification type.
type Preference struct {
	Type       string   `json:"type"`
	Channels   []string `json:"channels"`
	QuietStart *string  `json:"quietStart"`
	QuietEnd   *string  `json:"quietEnd"`
}

// Job is one claimed QUEUED delivery with everything the worker needs to send it.
type Job struct {
	DeliveryID      string
	SchoolID        string
	NotificationID  string
	UserID          string
	Attempt         int
	Type            string
	Title           string
	Body            string
	Urgent          bool
	ChildIDs        []string
	ChannelsAllowed []string
	Email           string
	Phone           string
}

// Result is the final state the worker writes for a delivery.
type Result struct {
	Status      string
	Channel     string
	Attempt     int
	ProviderRef string
	Error       string
}

// CallbackEvent is a provider delivery report normalised by ParseCallback.
type CallbackEvent struct {
	Provider    string
	EventID     string
	ProviderRef string
	Status      string
	Payload     []byte
}

// CallbackOutcome tells the caller what RecordCallback did.
type CallbackOutcome struct {
	Matched   bool
	Duplicate bool
}

// OutboxTopicUndelivered is published when every channel failed for a recipient.
const OutboxTopicUndelivered = "delivery.undelivered"

// canApplyCallback reports whether a provider report may move a delivery from this status.
func canApplyCallback(from string) bool { return from == StatusSent || from == StatusFailed }
