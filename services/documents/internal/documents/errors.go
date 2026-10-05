package documents

import (
	"net/http"

	kit "github.com/stackable/kyfaru-kit"
)

// docError builds an AppError with a DOMAIN_CONDITION code that kyfaru-kit has no constructor for.
func docError(status int, code, message string) *kit.AppError {
	return &kit.AppError{Status: status, Code: code, Message: message}
}

func notFoundErr() *kit.AppError {
	return docError(http.StatusNotFound, "DOCUMENT_NOT_FOUND", "Document not found.")
}

func linkExpiredErr() *kit.AppError {
	return docError(http.StatusForbidden, "DOCUMENT_LINK_EXPIRED", "This download link has expired. Request a new one.")
}

func linkInvalidErr() *kit.AppError {
	return docError(http.StatusForbidden, "DOCUMENT_LINK_INVALID", "This download link is not valid.")
}

// fieldError is one failed field in a validation response.
type fieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func invalid(message string, fields ...fieldError) *kit.AppError {
	return kit.Validation(message, map[string]any{"fields": fields})
}
