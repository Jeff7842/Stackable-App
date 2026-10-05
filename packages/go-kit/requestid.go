package kit

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

const (
	requestIDHeader = "X-Request-Id"
	maxRequestIDLen = 128 // longer ids are replaced so logs cannot be flooded
)

type ctxKey string

const requestIDKey ctxKey = "requestId"

func newRequestID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b) // crypto/rand does not fail on supported platforms
	return hex.EncodeToString(b)
}

func isSafeRequestID(id string) bool {
	if id == "" || len(id) > maxRequestIDLen {
		return false
	}
	for _, c := range id {
		ok := c == '-' || c == '_' || (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
		if !ok {
			return false
		}
	}
	return true
}

// RequestIDMiddleware reuses a safe incoming x-request-id or makes one, then echoes it.
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(requestIDHeader)
		if !isSafeRequestID(id) {
			id = newRequestID()
		}
		w.Header().Set(requestIDHeader, id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey, id)))
	})
}

// RequestID returns the request id stored in ctx, or an empty string.
func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey).(string)
	return id
}
