package documents

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	kit "github.com/stackable/kyfaru-kit"
)

// Handler exposes the document routes.
type Handler struct {
	svc      *Service
	verifier *kit.ServiceTokenVerifier
	files    *LocalStore // nil when R2 serves downloads directly
}

// NewHandler builds a Handler; files may be nil.
func NewHandler(svc *Service, verifier *kit.ServiceTokenVerifier, files *LocalStore) *Handler {
	return &Handler{svc: svc, verifier: verifier, files: files}
}

// Routes mounts the token-protected document routes and the signed-link file route.
func (h *Handler) Routes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(kit.RequireServiceToken(h.verifier))
		r.Post("/v1/documents", kit.Handle(h.create))
		r.Get("/v1/documents/{id}", kit.Handle(h.get))
	})
	if h.files != nil {
		r.Get("/v1/files/*", kit.Handle(h.file)) // the signature is the credential, so no bearer token
	}
}

func schoolFrom(r *http.Request) (string, error) {
	claims, ok := kit.ClaimsFrom(r.Context())
	if !ok || !isUUID(claims.SchoolID) {
		return "", kit.Unauthorized("Invalid service token.")
	}
	return claims.SchoolID, nil
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	school, err := schoolFrom(r)
	if err != nil {
		return err
	}
	var req CreateRequest
	if err := kit.DecodeJSON(w, r, &req); err != nil {
		return err
	}
	res, err := h.svc.Create(r.Context(), school, req)
	if err != nil {
		return err
	}
	status := http.StatusOK // SERVED
	switch res.Status {
	case StatusStoredAndCached:
		status = http.StatusCreated
	case StatusQueuedJob:
		status = http.StatusAccepted
	}
	kit.WriteJSON(w, status, res)
	return nil
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error {
	school, err := schoolFrom(r)
	if err != nil {
		return err
	}
	id := chi.URLParam(r, "id")
	if !isUUID(id) {
		return notFoundErr()
	}
	v, err := h.svc.Get(r.Context(), school, id)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, v)
	return nil
}

func (h *Handler) file(w http.ResponseWriter, r *http.Request) error {
	key := chi.URLParam(r, "*")
	data, err := h.files.Open(key, r.URL.Query().Get("exp"), r.URL.Query().Get("sig"))
	if err != nil {
		return err
	}
	format := FormatPDF
	if len(key) > 5 && key[len(key)-5:] == ".xlsx" {
		format = FormatXLSX
	}
	w.Header().Set("Content-Type", contentType(format))
	w.Header().Set("Content-Disposition", "attachment")
	w.Header().Set("Cache-Control", "private, no-store")
	_, _ = w.Write(data) // headers are sent, a failed write means the client left
	return nil
}
