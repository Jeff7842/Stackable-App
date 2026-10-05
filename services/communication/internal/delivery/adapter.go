package delivery

import (
	"context"
	"errors"
	"sync"
)

// ErrDisabled is returned by an adapter whose credentials are not configured.
var ErrDisabled = errors.New("channel adapter disabled")

// ErrNoAddress is returned when the recipient has no email or phone for the channel.
var ErrNoAddress = errors.New("recipient has no address for channel")

// Message is one send attempt on one channel.
type Message struct {
	SchoolID       string
	DeliveryID     string
	NotificationID string
	UserID         string
	Channel        string
	Type           string
	Title          string
	Body           string
	ChildIDs       []string
	Email          string
	Phone          string
}

// ChannelAdapter sends one message through a provider and returns the provider's reference.
type ChannelAdapter interface {
	Send(ctx context.Context, msg Message) (providerRef string, err error)
}

// FakeAdapter always succeeds unless FailWith was set; it records every call for tests.
type FakeAdapter struct {
	mu    sync.Mutex
	err   error
	calls []Message
}

// NewFakeAdapter returns an adapter that succeeds.
func NewFakeAdapter() *FakeAdapter { return &FakeAdapter{} }

// FailWith makes every following Send return err; nil restores success.
func (f *FakeAdapter) FailWith(err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.err = err
}

// Send implements ChannelAdapter.
func (f *FakeAdapter) Send(_ context.Context, msg Message) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, msg)
	if f.err != nil {
		return "", f.err
	}
	return "fake-" + msg.DeliveryID, nil
}

// Calls returns the messages sent so far.
func (f *FakeAdapter) Calls() []Message {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]Message{}, f.calls...)
}

// DisabledAdapter stands in for a channel with no provider; it always fails so the worker falls back.
type DisabledAdapter struct{}

// Send implements ChannelAdapter.
func (DisabledAdapter) Send(context.Context, Message) (string, error) { return "", ErrDisabled }
