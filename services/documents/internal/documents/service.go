package documents

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

const (
	CacheTTL    = 72 * time.Hour   // cache entries live 3 days, files and rows stay
	URLTTL      = 15 * time.Minute // download links are short-lived and re-signed on each GET
	SyncMaxRows = 500              // above this a render could miss the 2 s target, so it is queued
	maxVersion  = 128
)

// Config wires a Service; zero values get the defaults above.
type Config struct {
	Store       Store
	Objects     ObjectStore
	Renderers   map[Format]Renderer
	Clock       func() time.Time
	CacheTTL    time.Duration
	URLTTL      time.Duration
	SyncMaxRows int
}

// Service creates, serves and renders documents.
type Service struct {
	cfg Config
}

// NewService fills defaults.
func NewService(cfg Config) *Service {
	if cfg.Clock == nil {
		cfg.Clock = time.Now
	}
	if cfg.CacheTTL == 0 {
		cfg.CacheTTL = CacheTTL
	}
	if cfg.URLTTL == 0 {
		cfg.URLTTL = URLTTL
	}
	if cfg.SyncMaxRows == 0 {
		cfg.SyncMaxRows = SyncMaxRows
	}
	return &Service{cfg: cfg}
}

func objectKey(d Document) string {
	return fmt.Sprintf("%s/%s.%s", d.SchoolID, d.ID, d.Format)
}

func validateRequest(req CreateRequest) error {
	var f []fieldError
	switch req.Type {
	case TypeReceipt, TypeReportCard, TypeFeeStatement, TypeClassSheet, TypeGeneric:
	default:
		f = append(f, fieldError{"type", "must be receipt, report_card, fee_statement, class_sheet or generic"})
	}
	if req.Format != FormatPDF && req.Format != FormatXLSX {
		f = append(f, fieldError{"format", "must be pdf or xlsx"})
	}
	if req.DataVersion == "" || len(req.DataVersion) > maxVersion {
		f = append(f, fieldError{"dataVersion", "is required and at most 128 characters"})
	}
	if len(req.Data) == 0 {
		f = append(f, fieldError{"data", "is required"})
	}
	if len(req.Params) > 0 {
		var p map[string]any
		if err := json.Unmarshal(req.Params, &p); err != nil || p == nil {
			f = append(f, fieldError{"params", "must be an object"})
		}
	}
	if len(f) > 0 {
		return invalid("Request is invalid.", f...)
	}
	return nil
}

// Create returns a cached file, renders a small one now, or queues a large one.
// It exists so every module asks one service for files and repeated asks cost nothing.
func (s *Service) Create(ctx context.Context, schoolID string, req CreateRequest) (Result, error) {
	if err := validateRequest(req); err != nil {
		return Result{}, err
	}
	content, err := ParseContent(req.Type, req.Data)
	if err != nil {
		return Result{}, err
	}
	key, err := CacheKey(schoolID, req.Type, req.Params, req.DataVersion, req.Format)
	if err != nil {
		return Result{}, invalid("Request is invalid.", fieldError{"params", "must be valid JSON"})
	}

	now := s.cfg.Clock()
	if hit, ok, err := s.cfg.Store.FindCachedDocument(ctx, schoolID, key, now); err != nil {
		return Result{}, err
	} else if ok {
		url, err := s.cfg.Objects.SignedURL(hit.ObjectKey, s.cfg.URLTTL)
		if err != nil {
			return Result{}, err
		}
		return Result{ID: hit.ID, Status: StatusServed, URL: url}, nil
	}

	params := req.Params
	if len(params) == 0 {
		params = json.RawMessage("{}")
	}
	doc := Document{
		ID: newUUID(), SchoolID: schoolID, Type: req.Type, Format: req.Format,
		Params: params, DataVersion: req.DataVersion, CreatedAt: now, UpdatedAt: now,
	}
	if content.RowCount() > s.cfg.SyncMaxRows {
		doc.Status, doc.JobPayload = StatusQueuedJob, req.Data
		if err := s.cfg.Store.CreateDocument(ctx, doc); err != nil {
			return Result{}, err
		}
		return Result{ID: doc.ID, Status: StatusQueuedJob}, nil
	}

	if err := s.render(ctx, &doc, content); err != nil {
		return Result{}, err
	}
	entry := CacheEntry{SchoolID: schoolID, CacheKey: key, DocumentID: doc.ID, ExpiresAt: now.Add(s.cfg.CacheTTL)}
	if err := s.cfg.Store.CreateRendered(ctx, doc, entry); err != nil {
		return Result{}, err
	}
	url, err := s.cfg.Objects.SignedURL(doc.ObjectKey, s.cfg.URLTTL)
	if err != nil {
		return Result{}, err
	}
	return Result{ID: doc.ID, Status: StatusStoredAndCached, URL: url, RenderMs: &doc.RenderMs}, nil
}

// render fills ObjectKey, RenderMs and Status on d after storing the file.
func (s *Service) render(ctx context.Context, d *Document, c Content) error {
	r, ok := s.cfg.Renderers[d.Format]
	if !ok {
		return invalid("Format is not supported.", fieldError{"format", "no renderer for " + string(d.Format)})
	}
	start := time.Now() // wall clock on purpose: the injectable clock drives TTLs, not timings
	data, err := r.Render(ctx, c)
	if err != nil {
		return fmt.Errorf("render %s: %w", d.Format, err)
	}
	d.RenderMs = time.Since(start).Milliseconds()
	d.ObjectKey = objectKey(*d)
	if err := s.cfg.Objects.Put(ctx, d.ObjectKey, contentType(d.Format), data); err != nil {
		return fmt.Errorf("store file: %w", err)
	}
	d.Status, d.JobPayload = StatusStoredAndCached, nil
	d.UpdatedAt = s.cfg.Clock()
	return nil
}

// Get returns a document's status and a freshly signed link when the file exists.
func (s *Service) Get(ctx context.Context, schoolID, id string) (View, error) {
	d, err := s.cfg.Store.GetDocument(ctx, schoolID, id)
	if err != nil {
		return View{}, err
	}
	v := View{ID: d.ID, Status: d.Status, Type: d.Type, Format: d.Format, CreatedAt: d.CreatedAt}
	if d.ObjectKey != "" {
		if v.URL, err = s.cfg.Objects.SignedURL(d.ObjectKey, s.cfg.URLTTL); err != nil {
			return View{}, err
		}
		ms := d.RenderMs
		v.RenderMs = &ms
	}
	return v, nil
}

// PurgeExpired removes expired cache rows; never the stored file or the document row.
func (s *Service) PurgeExpired(ctx context.Context) (int, error) {
	return s.cfg.Store.PurgeExpiredCache(ctx, s.cfg.Clock())
}
