package notifications

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	kit "github.com/stackable/go-kit"
)

const (
	maxRecipients  = 1000 // one request cannot fan out to more than a large school
	maxTitleLen    = 200
	maxBodyLen     = 5000
	maxTypeLen     = 64
	maxKeyLen      = 128
	defaultLimit   = 20
	maxInboxLimit  = 100
	maxChildIDs    = 20
	maxPrefsPerPut = 50
)

var (
	uuidPattern  = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	clockPattern = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)
)

// NewID returns a random UUID v4 string.
func NewID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b) // crypto/rand does not fail on supported platforms
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// RecipientInput is one already-resolved recipient from the caller.
type RecipientInput struct {
	UserID          string   `json:"userId"`
	ChildIDs        []string `json:"childIds"`
	ChannelsAllowed []string `json:"channelsAllowed"`
	Email           string   `json:"email"`
	Phone           string   `json:"phone"`
}

// CreateInput is the body of POST /v1/notifications.
type CreateInput struct {
	Type           string           `json:"type"`
	Title          string           `json:"title"`
	Body           string           `json:"body"`
	Recipients     []RecipientInput `json:"recipients"`
	Urgent         bool             `json:"urgent"`
	IdempotencyKey string           `json:"idempotencyKey"`
}

// InboxPage is one page of a user's inbox.
type InboxPage struct {
	Items      []InboxItem `json:"items"`
	NextCursor *string     `json:"nextCursor"`
}

// Service holds the notification rules. It knows nothing about HTTP.
type Service struct {
	store Store
}

// NewService builds a Service over a Store.
func NewService(store Store) *Service { return &Service{store: store} }

func isValidChannel(c string) bool {
	for _, known := range ChannelOrder {
		if c == known {
			return true
		}
	}
	return false
}

// orderedChannels returns the set in fallback order; an empty set means every channel.
func orderedChannels(set map[string]bool) []string {
	out := []string{}
	for _, c := range ChannelOrder {
		if len(set) == 0 || set[c] {
			out = append(out, c)
		}
	}
	return out
}

func addUnique(list []string, items ...string) []string {
	seen := map[string]bool{}
	for _, v := range list {
		seen[v] = true
	}
	for _, v := range items {
		if !seen[v] {
			seen[v] = true
			list = append(list, v)
		}
	}
	return list
}

// validateCreate checks the whole body and reports every failed field at once.
func validateCreate(in *CreateInput) error {
	bad := map[string]string{}
	in.Type, in.Title, in.IdempotencyKey = strings.TrimSpace(in.Type), strings.TrimSpace(in.Title), strings.TrimSpace(in.IdempotencyKey)
	if in.Type == "" || len(in.Type) > maxTypeLen {
		bad["type"] = "required, at most 64 characters"
	}
	if in.Title == "" || len(in.Title) > maxTitleLen {
		bad["title"] = "required, at most 200 characters"
	}
	if in.Body == "" || len(in.Body) > maxBodyLen {
		bad["body"] = "required, at most 5000 characters"
	}
	if in.IdempotencyKey == "" || len(in.IdempotencyKey) > maxKeyLen {
		bad["idempotencyKey"] = "required, at most 128 characters"
	}
	if len(in.Recipients) == 0 || len(in.Recipients) > maxRecipients {
		bad["recipients"] = "between 1 and 1000 recipients required"
	}
	for i := range in.Recipients {
		r := &in.Recipients[i]
		r.UserID = strings.ToLower(strings.TrimSpace(r.UserID))
		if !uuidPattern.MatchString(r.UserID) {
			bad[fmt.Sprintf("recipients[%d].userId", i)] = "must be a uuid"
		}
		if len(r.ChildIDs) > maxChildIDs {
			bad[fmt.Sprintf("recipients[%d].childIds", i)] = "at most 20 children"
		}
		for j := range r.ChildIDs {
			r.ChildIDs[j] = strings.ToLower(strings.TrimSpace(r.ChildIDs[j]))
			if !uuidPattern.MatchString(r.ChildIDs[j]) {
				bad[fmt.Sprintf("recipients[%d].childIds[%d]", i, j)] = "must be a uuid"
			}
		}
		for _, c := range r.ChannelsAllowed {
			if !isValidChannel(c) {
				bad[fmt.Sprintf("recipients[%d].channelsAllowed", i)] = "allowed values are push, sms, email"
			}
		}
	}
	if len(bad) > 0 {
		return kit.Validation("Notification is invalid.", bad)
	}
	return nil
}

// dedupeRecipients merges repeated parents into one entry that lists all their children.
// Channel sets are unioned so a parent allowed on push for one child and sms for another gets both.
func dedupeRecipients(in []RecipientInput) []Recipient {
	var order []string
	byUser := map[string]*Recipient{}
	channels := map[string]map[string]bool{}
	for _, r := range in {
		cur, seen := byUser[r.UserID]
		if !seen {
			cur = &Recipient{UserID: r.UserID, ChildIDs: []string{}}
			byUser[r.UserID] = cur
			channels[r.UserID] = map[string]bool{}
			order = append(order, r.UserID)
		}
		cur.ChildIDs = addUnique(cur.ChildIDs, r.ChildIDs...)
		if cur.Email == "" {
			cur.Email = strings.TrimSpace(r.Email)
		}
		if cur.Phone == "" {
			cur.Phone = strings.TrimSpace(r.Phone)
		}
		// an entry with no channel list allows everything, so the union becomes "all"
		if len(r.ChannelsAllowed) == 0 {
			for _, c := range ChannelOrder {
				channels[r.UserID][c] = true
			}
		}
		for _, c := range r.ChannelsAllowed {
			channels[r.UserID][c] = true
		}
	}
	out := make([]Recipient, 0, len(order))
	for _, id := range order {
		byUser[id].ChannelsAllowed = orderedChannels(channels[id])
		out = append(out, *byUser[id])
	}
	return out
}

// Create stores a notification and queues one delivery per distinct parent.
// A repeated idempotency key returns the original notification and created=false.
func (s *Service) Create(ctx context.Context, schoolID string, in CreateInput) (Notification, bool, error) {
	if err := validateCreate(&in); err != nil {
		return Notification{}, false, err
	}
	n, created, err := s.store.CreateNotification(ctx, NewNotification{
		Notification: Notification{ID: NewID(), Type: in.Type, Title: in.Title, Body: in.Body, Urgent: in.Urgent, IdempotencyKey: in.IdempotencyKey},
		SchoolID:     schoolID,
		Recipients:   dedupeRecipients(in.Recipients),
	})
	if err != nil {
		return Notification{}, false, fmt.Errorf("create notification: %w", err)
	}
	return n, created, nil
}

func encodeCursor(c Cursor) string {
	return base64.RawURLEncoding.EncodeToString([]byte(c.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + c.ID))
}

func decodeCursor(raw string) (*Cursor, error) {
	if raw == "" {
		return nil, nil
	}
	b, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return nil, kit.Validation("Cursor is invalid.", nil)
	}
	ts, id, found := strings.Cut(string(b), "|")
	t, perr := time.Parse(time.RFC3339Nano, ts)
	if !found || perr != nil || !uuidPattern.MatchString(id) {
		return nil, kit.Validation("Cursor is invalid.", nil)
	}
	return &Cursor{CreatedAt: t, ID: id}, nil
}

// Inbox returns one page of the user's notifications; limit 0 means the default.
func (s *Service) Inbox(ctx context.Context, schoolID, userID string, limit int, rawCursor string) (InboxPage, error) {
	if limit < 0 || limit > maxInboxLimit {
		return InboxPage{}, kit.Validation("limit must be between 1 and 100.", map[string]string{"limit": "1-100"})
	}
	if limit == 0 {
		limit = defaultLimit
	}
	after, err := decodeCursor(rawCursor)
	if err != nil {
		return InboxPage{}, err
	}
	// one extra row tells us whether another page exists
	items, err := s.store.ListInbox(ctx, schoolID, userID, limit+1, after)
	if err != nil {
		return InboxPage{}, fmt.Errorf("list inbox: %w", err)
	}
	page := InboxPage{Items: items}
	if len(items) > limit {
		page.Items = items[:limit]
		last := page.Items[limit-1]
		next := encodeCursor(Cursor{CreatedAt: last.CreatedAt, ID: last.ID})
		page.NextCursor = &next
	}
	return page, nil
}

// MarkRead marks one notification read for the caller.
func (s *Service) MarkRead(ctx context.Context, schoolID, userID, notificationID string) error {
	if !uuidPattern.MatchString(notificationID) {
		return kit.Validation("Notification id must be a uuid.", nil)
	}
	if err := s.store.MarkRead(ctx, schoolID, userID, notificationID); err != nil {
		return mapNotFound(err, "Notification not found.")
	}
	return nil
}

// Preferences lists the caller's preference rows.
func (s *Service) Preferences(ctx context.Context, schoolID, userID string) ([]Preference, error) {
	prefs, err := s.store.ListPreferences(ctx, schoolID, userID)
	if err != nil {
		return nil, fmt.Errorf("list preferences: %w", err)
	}
	return prefs, nil
}

func validatePreferences(prefs []Preference) error {
	bad := map[string]string{}
	if len(prefs) == 0 || len(prefs) > maxPrefsPerPut {
		bad["preferences"] = "between 1 and 50 rows required"
	}
	for i, p := range prefs {
		field := fmt.Sprintf("preferences[%d]", i)
		if p.Type == "" || len(p.Type) > maxTypeLen {
			bad[field+".type"] = "required, at most 64 characters"
		}
		if len(p.Channels) == 0 {
			bad[field+".channels"] = "at least one channel required"
		}
		for _, c := range p.Channels {
			if !isValidChannel(c) {
				bad[field+".channels"] = "allowed values are push, sms, email"
			}
		}
		if (p.QuietStart == nil) != (p.QuietEnd == nil) {
			bad[field+".quietStart"] = "quietStart and quietEnd must be set together"
		} else if p.QuietStart != nil && (!clockPattern.MatchString(*p.QuietStart) || !clockPattern.MatchString(*p.QuietEnd)) {
			bad[field+".quietStart"] = "times must be HH:MM"
		}
	}
	if len(bad) > 0 {
		return kit.Validation("Preferences are invalid.", bad)
	}
	return nil
}

// SavePreferences upserts the given types and returns all of the caller's rows.
func (s *Service) SavePreferences(ctx context.Context, schoolID, userID string, prefs []Preference) ([]Preference, error) {
	if err := validatePreferences(prefs); err != nil {
		return nil, err
	}
	for i := range prefs {
		prefs[i].Channels = orderedChannelsFrom(prefs[i].Channels)
	}
	if err := s.store.SavePreferences(ctx, schoolID, userID, prefs); err != nil {
		return nil, fmt.Errorf("save preferences: %w", err)
	}
	return s.Preferences(ctx, schoolID, userID)
}

func orderedChannelsFrom(list []string) []string {
	set := map[string]bool{}
	for _, c := range list {
		set[c] = true
	}
	return orderedChannels(set)
}

// DeliveryCounts returns how many deliveries of a notification sit in each status.
func (s *Service) DeliveryCounts(ctx context.Context, schoolID, notificationID string) (map[string]int, error) {
	if !uuidPattern.MatchString(notificationID) {
		return nil, kit.Validation("Notification id must be a uuid.", nil)
	}
	counts, err := s.store.DeliveryCounts(ctx, schoolID, notificationID)
	if err != nil {
		return nil, mapNotFound(err, "Notification not found.")
	}
	return counts, nil
}

func mapNotFound(err error, message string) error {
	if errors.Is(err, ErrNotFound) {
		return kit.NotFound(message)
	}
	return err
}
