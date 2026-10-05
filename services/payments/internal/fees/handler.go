package fees

import (
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	kit "github.com/stackable/kyfaru-kit"
)

const maxWebhookBytes = 1 << 20 // 1 MiB cap on provider callbacks

// Handler exposes the HTTP routes; it only parses, validates and maps errors.
type Handler struct {
	svc *Service
}

// NewHandler builds a Handler over a Service.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Routes mounts the service-token routes under auth and the provider webhook without it.
func (h *Handler) Routes(r chi.Router, auth func(http.Handler) http.Handler) {
	r.Post("/v1/webhooks/{provider}", kit.Handle(h.webhook))
	r.Group(func(g chi.Router) {
		g.Use(auth)
		g.Post("/v1/fee-structures", kit.Handle(h.createFeeStructure))
		g.Get("/v1/fee-structures", kit.Handle(h.listFeeStructures))
		g.Post("/v1/invoices", kit.Handle(h.issueInvoices))
		g.Get("/v1/students/{id}/statement", kit.Handle(h.statement))
		g.Post("/v1/payments/intent", kit.Handle(h.intent))
		g.Get("/v1/payments/{id}", kit.Handle(h.getPayment))
		g.Get("/v1/unmatched", kit.Handle(h.listUnmatched))
		g.Post("/v1/unmatched/{id}/resolve", kit.Handle(h.resolve))
		g.Get("/v1/reconciliation", kit.Handle(h.reconciliation))
	})
}

func claims(r *http.Request) (*kit.ServiceClaims, error) {
	c, ok := kit.ClaimsFrom(r.Context())
	if !ok {
		return nil, kit.Unauthorized("Missing service token.")
	}
	return c, nil
}

func pathID(r *http.Request, name string) (string, error) {
	id := chi.URLParam(r, name)
	if !isUUID(id) {
		return "", kit.Validation("Path id must be a UUID.", map[string]string{name: "must be a UUID"})
	}
	return id, nil
}

func pageParams(r *http.Request) (after string, limit int, err error) {
	limit = defaultPageSize
	if v := r.URL.Query().Get("limit"); v != "" {
		if limit, err = strconv.Atoi(v); err != nil || limit < 1 || limit > maxPageSize {
			return "", 0, kit.Validation("limit must be between 1 and 500.", map[string]string{"limit": "1-500"})
		}
	}
	after = r.URL.Query().Get("after")
	if after != "" && !isUUID(after) {
		return "", 0, kit.Validation("after must be a UUID.", map[string]string{"after": "must be a UUID"})
	}
	return after, limit, nil
}

func nextCursor(n, limit int, last string) string {
	if n == limit {
		return last
	}
	return ""
}

func (h *Handler) webhook(w http.ResponseWriter, r *http.Request) error {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxWebhookBytes))
	if err != nil {
		return kit.Validation("Webhook body is too large or unreadable.", nil)
	}
	res, err := h.svc.ReceiveWebhook(r.Context(), chi.URLParam(r, "provider"), r.Header, body)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, map[string]any{"received": true, "duplicate": res.Duplicate, "outcome": res.Outcome})
	return nil
}

func (h *Handler) createFeeStructure(w http.ResponseWriter, r *http.Request) error {
	c, err := claims(r)
	if err != nil {
		return err
	}
	var in FeeStructureInput
	if err := kit.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := in.Validate(); err != nil {
		return err
	}
	fs, err := h.svc.CreateFeeStructure(r.Context(), c.SchoolID, in)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusCreated, fs)
	return nil
}

func (h *Handler) listFeeStructures(w http.ResponseWriter, r *http.Request) error {
	c, err := claims(r)
	if err != nil {
		return err
	}
	after, limit, err := pageParams(r)
	if err != nil {
		return err
	}
	q := r.URL.Query()
	items, err := h.svc.ListFeeStructures(r.Context(), c.SchoolID, q.Get("term"), q.Get("level"), after, limit)
	if err != nil {
		return err
	}
	cursor := ""
	if len(items) > 0 {
		cursor = nextCursor(len(items), limit, items[len(items)-1].ID)
	}
	kit.WriteJSON(w, http.StatusOK, map[string]any{"items": nonNil(items), "nextCursor": cursor})
	return nil
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

func (h *Handler) issueInvoices(w http.ResponseWriter, r *http.Request) error {
	c, err := claims(r)
	if err != nil {
		return err
	}
	var in IssueInvoicesInput
	if err := kit.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := in.Validate(); err != nil {
		return err
	}
	invoices, err := h.svc.IssueInvoices(r.Context(), c.SchoolID, in)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusCreated, map[string]any{"invoices": invoices})
	return nil
}

func (h *Handler) statement(w http.ResponseWriter, r *http.Request) error {
	c, err := claims(r)
	if err != nil {
		return err
	}
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	st, err := h.svc.GetStatement(r.Context(), c.SchoolID, id, r.URL.Query().Get("term"))
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, st)
	return nil
}

func (h *Handler) intent(w http.ResponseWriter, r *http.Request) error {
	c, err := claims(r)
	if err != nil {
		return err
	}
	var in IntentInput
	if err := kit.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := in.Validate(); err != nil {
		return err
	}
	pay, created, err := h.svc.CreateIntent(r.Context(), c.SchoolID, c.Subject, in)
	if err != nil {
		return err
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	kit.WriteJSON(w, status, pay)
	return nil
}

func (h *Handler) getPayment(w http.ResponseWriter, r *http.Request) error {
	c, err := claims(r)
	if err != nil {
		return err
	}
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	pay, err := h.svc.GetPayment(r.Context(), c.SchoolID, id)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, pay)
	return nil
}

func (h *Handler) listUnmatched(w http.ResponseWriter, r *http.Request) error {
	c, err := claims(r)
	if err != nil {
		return err
	}
	after, limit, err := pageParams(r)
	if err != nil {
		return err
	}
	rows, err := h.svc.ListUnmatched(r.Context(), c.SchoolID, r.URL.Query().Get("includeResolved") == "true", after, limit)
	if err != nil {
		return err
	}
	cursor := ""
	if len(rows) > 0 {
		cursor = nextCursor(len(rows), limit, rows[len(rows)-1].PaymentID)
	}
	kit.WriteJSON(w, http.StatusOK, map[string]any{"items": nonNil(rows), "nextCursor": cursor})
	return nil
}

func (h *Handler) resolve(w http.ResponseWriter, r *http.Request) error {
	c, err := claims(r)
	if err != nil {
		return err
	}
	id, err := pathID(r, "id")
	if err != nil {
		return err
	}
	var in ResolveInput
	if err := kit.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := in.Validate(); err != nil {
		return err
	}
	pay, err := h.svc.ResolveUnmatched(r.Context(), c.SchoolID, c.Subject, id, in)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, pay)
	return nil
}

func (h *Handler) reconciliation(w http.ResponseWriter, r *http.Request) error {
	c, err := claims(r)
	if err != nil {
		return err
	}
	from, to, err := ParseRange(r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	if err != nil {
		return err
	}
	after, limit, err := pageParams(r)
	if err != nil {
		return err
	}
	limit = min(limit, maxReconRows)
	rows, err := h.svc.Reconciliation(r.Context(), c.SchoolID, from, to, after, limit)
	if err != nil {
		return err
	}
	cursor := ""
	if len(rows) > 0 {
		cursor = nextCursor(len(rows), limit, rows[len(rows)-1].PaymentID)
	}
	kit.WriteJSON(w, http.StatusOK, map[string]any{"rows": nonNil(rows), "nextCursor": cursor})
	return nil
}
