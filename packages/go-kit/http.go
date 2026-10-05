package kit

import (
	"encoding/json"
	"net/http"
)

const maxBodyBytes = 1 << 20 // 1 MiB cap so one request cannot exhaust memory

// HandlerFunc is an http handler that returns its error instead of writing it.
type HandlerFunc func(w http.ResponseWriter, r *http.Request) error

// Handle adapts a HandlerFunc so every returned error becomes the standard envelope.
func Handle(fn HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := fn(w, r); err != nil {
			WriteError(w, r, err)
		}
	}
}

// WriteJSON writes v as JSON with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v) // headers are already sent, so a write failure cannot be reported
}

// DecodeJSON reads a size-limited JSON body into dst and returns a validation error on bad input.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		return Validation("Request body must be valid JSON.", nil)
	}
	return nil
}
