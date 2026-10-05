package fees

import (
	"net/http"
	"slices"
	"strings"
	"time"

	kit "github.com/stackable/kyfaru-kit"
)

const (
	maxNameLen        = 120
	maxItems          = 50
	maxStudentsPerRun = 500 // one invoice run is one transaction, so it is bounded
	maxLinesPerCall   = 50
	maxKeyLen         = 128
	defaultPageSize   = 100
	maxPageSize       = 500
	maxReconRows      = 5000
	statementLineCap  = 500
	statementPayCap   = 100
)

type fieldErrors map[string]string

func (f fieldErrors) err() error {
	if len(f) == 0 {
		return nil
	}
	return kit.Validation("Some fields are invalid.", map[string]string(f))
}

func domainErr(status int, code, message string, details any) *kit.AppError {
	return &kit.AppError{Status: status, Code: code, Message: message, Details: details}
}

func conflict(code, message string) *kit.AppError {
	return domainErr(http.StatusConflict, code, message, nil)
}

func notFound(code, message string) *kit.AppError {
	return domainErr(http.StatusNotFound, code, message, nil)
}

func unprocessable(code, message string) *kit.AppError {
	return domainErr(http.StatusUnprocessableEntity, code, message, nil)
}

func checkText(f fieldErrors, name, v string) {
	if strings.TrimSpace(v) == "" || len(v) > maxNameLen {
		f[name] = "required, at most 120 characters"
	}
}

func checkIDs(f fieldErrors, name string, ids []string, max int) {
	if len(ids) > max {
		f[name] = "too many ids"
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if !isUUID(id) || seen[id] {
			f[name] = "must be unique UUIDs"
			return
		}
		seen[id] = true
	}
}

// FeeItemInput is one item of a new fee structure.
type FeeItemInput struct {
	Name        string `json:"name"`
	AmountMinor int64  `json:"amountMinor"`
	Mandatory   bool   `json:"mandatory"`
}

// FeeStructureInput is the body of POST /v1/fee-structures.
type FeeStructureInput struct {
	Name  string         `json:"name"`
	Term  string         `json:"term"`
	Level string         `json:"level"`
	Items []FeeItemInput `json:"items"`
}

// Validate rejects malformed input before any business logic runs.
func (in FeeStructureInput) Validate() error {
	f := fieldErrors{}
	checkText(f, "name", in.Name)
	checkText(f, "term", in.Term)
	checkText(f, "level", in.Level)
	if len(in.Items) == 0 || len(in.Items) > maxItems {
		f["items"] = "between 1 and 50 items"
	}
	for _, it := range in.Items {
		if strings.TrimSpace(it.Name) == "" || len(it.Name) > maxNameLen || it.AmountMinor <= 0 {
			f["items"] = "each item needs a name and amountMinor greater than 0"
		}
	}
	return f.err()
}

// LineInput is one custom invoice line.
type LineInput struct {
	Description string `json:"description"`
	AmountMinor int64  `json:"amountMinor"`
	FeeItemID   string `json:"feeItemId"`
}

// IssueInvoicesInput is the body of POST /v1/invoices: a fee structure or custom lines, not both.
type IssueInvoicesInput struct {
	StudentIDs     []string    `json:"studentIds"`
	FeeStructureID string      `json:"feeStructureId"`
	Term           string      `json:"term"`
	Lines          []LineInput `json:"lines"`
}

// Validate rejects malformed input before any business logic runs.
func (in IssueInvoicesInput) Validate() error {
	f := fieldErrors{}
	if len(in.StudentIDs) == 0 {
		f["studentIds"] = "at least one student"
	}
	checkIDs(f, "studentIds", in.StudentIDs, maxStudentsPerRun)
	switch {
	case in.FeeStructureID != "" && len(in.Lines) > 0:
		f["lines"] = "send feeStructureId or lines, not both"
	case in.FeeStructureID != "":
		if !isUUID(in.FeeStructureID) {
			f["feeStructureId"] = "must be a UUID"
		}
	case len(in.Lines) == 0 || len(in.Lines) > maxLinesPerCall:
		f["lines"] = "feeStructureId or between 1 and 50 lines required"
	default:
		checkText(f, "term", in.Term)
		for _, l := range in.Lines {
			if strings.TrimSpace(l.Description) == "" || len(l.Description) > maxNameLen || l.AmountMinor <= 0 || (l.FeeItemID != "" && !isUUID(l.FeeItemID)) {
				f["lines"] = "each line needs a description and amountMinor greater than 0"
			}
		}
	}
	return f.err()
}

// IntentInput is the body of POST /v1/payments/intent.
type IntentInput struct {
	StudentID      string   `json:"studentId"`
	AmountMinor    int64    `json:"amountMinor"`
	Rail           string   `json:"rail"`
	InvoiceLineIDs []string `json:"invoiceLineIds"`
	IdempotencyKey string   `json:"idempotencyKey"`
	PayerPhone     string   `json:"payerPhone"`
}

// Validate rejects malformed input before any business logic runs.
func (in IntentInput) Validate() error {
	f := fieldErrors{}
	if !isUUID(in.StudentID) {
		f["studentId"] = "must be a UUID"
	}
	if in.AmountMinor <= 0 {
		f["amountMinor"] = "must be greater than 0"
	}
	if !slices.Contains([]string{RailMpesa, RailCard, RailBank, RailFake}, in.Rail) {
		f["rail"] = "must be mpesa, card, bank or fake"
	}
	if len(in.InvoiceLineIDs) == 0 {
		f["invoiceLineIds"] = "choose at least one line"
	}
	checkIDs(f, "invoiceLineIds", in.InvoiceLineIDs, maxLinesPerCall)
	if in.IdempotencyKey == "" || len(in.IdempotencyKey) > maxKeyLen {
		f["idempotencyKey"] = "required, at most 128 characters"
	}
	if in.Rail == RailMpesa && strings.TrimSpace(in.PayerPhone) == "" {
		f["payerPhone"] = "required for mpesa"
	}
	return f.err()
}

// ResolveInput is the body of POST /v1/unmatched/{id}/resolve; no lines means the money becomes student credit.
type ResolveInput struct {
	StudentID      string   `json:"studentId"`
	InvoiceLineIDs []string `json:"invoiceLineIds"`
}

// Validate rejects malformed input before any business logic runs.
func (in ResolveInput) Validate() error {
	f := fieldErrors{}
	if !isUUID(in.StudentID) {
		f["studentId"] = "must be a UUID"
	}
	checkIDs(f, "invoiceLineIds", in.InvoiceLineIDs, maxLinesPerCall)
	return f.err()
}

// ParseRange reads from and to as RFC 3339 or YYYY-MM-DD; to is exclusive.
func ParseRange(from, to string) (time.Time, time.Time, error) {
	f := fieldErrors{}
	parse := func(name, v string) time.Time {
		for _, layout := range []string{time.RFC3339, "2006-01-02"} {
			if t, err := time.Parse(layout, v); err == nil {
				return t.UTC()
			}
		}
		f[name] = "required, RFC 3339 or YYYY-MM-DD"
		return time.Time{}
	}
	start, end := parse("from", from), parse("to", to)
	if len(f) == 0 && !start.Before(end) {
		f["to"] = "must be after from"
	}
	return start, end, f.err()
}
