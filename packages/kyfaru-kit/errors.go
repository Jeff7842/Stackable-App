package kit

import (
	"errors"
	"net/http"
)

// AppError is an operational error that maps to one HTTP status and one stable code.
type AppError struct {
	Status  int
	Code    string
	Message string
	Details any
}

func (e *AppError) Error() string { return e.Code + ": " + e.Message }

func newErr(status int, code, message string, details any) *AppError {
	return &AppError{Status: status, Code: code, Message: message, Details: details}
}

// Validation builds a 400 error; details usually lists the failed fields.
func Validation(message string, details any) *AppError {
	return newErr(http.StatusBadRequest, "VALIDATION_FAILED", message, details)
}

// Unauthorized builds a 401 error.
func Unauthorized(message string) *AppError {
	return newErr(http.StatusUnauthorized, "AUTH_UNAUTHORIZED", message, nil)
}

// Forbidden builds a 403 error.
func Forbidden(message string) *AppError {
	return newErr(http.StatusForbidden, "AUTH_FORBIDDEN", message, nil)
}

// NotFound builds a 404 error.
func NotFound(message string) *AppError {
	return newErr(http.StatusNotFound, "RESOURCE_NOT_FOUND", message, nil)
}

// Conflict builds a 409 error.
func Conflict(message string) *AppError {
	return newErr(http.StatusConflict, "RESOURCE_CONFLICT", message, nil)
}

// RateLimited builds a 429 error.
func RateLimited(message string) *AppError {
	return newErr(http.StatusTooManyRequests, "RATE_LIMITED", message, nil)
}

// Upstream builds a 502 error for a failing dependency.
func Upstream(message string) *AppError {
	return newErr(http.StatusBadGateway, "UPSTREAM_FAILED", message, nil)
}

// Unavailable builds a 503 error.
func Unavailable(message string) *AppError {
	return newErr(http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", message, nil)
}

// Internal builds a 500 error with a fixed safe message.
func Internal() *AppError {
	return newErr(http.StatusInternalServerError, "INTERNAL_ERROR", "Something went wrong. Please try again.", nil)
}

type envelope struct {
	Error     string `json:"error"`
	Code      string `json:"code"`
	Details   any    `json:"details,omitempty"`
	RequestID string `json:"requestId"`
}

// WriteError sends the standard envelope; unknown errors are logged and become a safe 500.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	var appErr *AppError
	if !errors.As(err, &appErr) {
		LoggerFrom(r.Context()).Error("unhandled error", "err", err)
		appErr = Internal()
	}
	WriteJSON(w, appErr.Status, envelope{
		Error:     appErr.Message,
		Code:      appErr.Code,
		Details:   appErr.Details,
		RequestID: RequestID(r.Context()),
	})
}
