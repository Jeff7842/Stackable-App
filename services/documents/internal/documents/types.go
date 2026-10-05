package documents

import (
	"encoding/json"
	"time"
)

// DocType is the business kind of a document.
type DocType string

// Format is the output file format.
type Format string

// Status is the lifecycle state of a document row or the outcome of a request.
type Status string

const (
	TypeReceipt      DocType = "receipt"
	TypeReportCard   DocType = "report_card"
	TypeFeeStatement DocType = "fee_statement"
	TypeClassSheet   DocType = "class_sheet"
	TypeGeneric      DocType = "generic"

	FormatPDF  Format = "pdf"
	FormatXLSX Format = "xlsx"

	StatusServed          Status = "SERVED"            // response only: cache hit
	StatusStoredAndCached Status = "STORED_AND_CACHED" // file stored and cache row written
	StatusQueuedJob       Status = "QUEUED_JOB"        // waiting for the worker
	StatusRendering       Status = "RENDERING"         // claimed by the worker
	StatusFailed          Status = "FAILED"            // render failed, needs a new request
)

// Document is one stored (or pending) rendered file.
type Document struct {
	ID          string
	SchoolID    string
	Type        DocType
	Format      Format
	Params      json.RawMessage
	DataVersion string
	ObjectKey   string
	Status      Status
	RenderMs    int64
	JobPayload  json.RawMessage // caller data, kept only while the job is queued
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// CacheEntry maps a cache key to a stored document until ExpiresAt.
type CacheEntry struct {
	SchoolID   string
	CacheKey   string
	DocumentID string
	ExpiresAt  time.Time
}

// OutboxEvent is a fact to be relayed to other services.
type OutboxEvent struct {
	ID        string
	SchoolID  string
	Topic     string
	Payload   json.RawMessage
	CreatedAt time.Time
}

// CreateRequest is the POST /v1/documents body; the school comes from the token, never the body.
type CreateRequest struct {
	Type        DocType         `json:"type"`
	Format      Format          `json:"format"`
	Params      json.RawMessage `json:"params"`
	DataVersion string          `json:"dataVersion"`
	Data        json.RawMessage `json:"data"`
}

// Result is the POST /v1/documents response.
type Result struct {
	ID       string `json:"id"`
	Status   Status `json:"status"`
	URL      string `json:"url,omitempty"`
	RenderMs *int64 `json:"renderMs,omitempty"`
}

// View is the GET /v1/documents/{id} response.
type View struct {
	ID        string    `json:"id"`
	Status    Status    `json:"status"`
	Type      DocType   `json:"type"`
	Format    Format    `json:"format"`
	URL       string    `json:"url,omitempty"`
	RenderMs  *int64    `json:"renderMs,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}
