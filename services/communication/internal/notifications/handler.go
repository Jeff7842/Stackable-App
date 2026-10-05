package notifications

import (
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	kit "github.com/stackable/go-kit"
)

const maxCallbackBytes = 1 << 20 // 1 MiB, same cap as every other body

// Handler exposes the notification routes.
type Handler struct {
	svc      *Service
	verifier SignatureVerifier
}

// NewHandler builds a Handler; the verifier guards the public callback route.
func NewHandler(svc *Service, verifier SignatureVerifier) *Handler {
	return &Handler{svc: svc, verifier: verifier}
}

// Routes mounts the /v1 routes; everything except callbacks needs a service token.
func (h *Handler) Routes(r chi.Router, tokens *kit.ServiceTokenVerifier) {
	r.Post("/v1/callbacks/{provider}", kit.Handle(h.callback))
	r.Group(func(g chi.Router) {
		g.Use(kit.RequireServiceToken(tokens))
		g.Post("/v1/notifications", kit.Handle(h.create))
		g.Get("/v1/notifications/{id}/deliveries", kit.Handle(h.deliveries))
		g.Get("/v1/inbox", kit.Handle(h.inbox))
		g.Post("/v1/inbox/{id}/read", kit.Handle(h.markRead))
		g.Get("/v1/preferences", kit.Handle(h.getPreferences))
		g.Put("/v1/preferences", kit.Handle(h.putPreferences))
	})
}

// actor returns the school and user the service token was issued for.
func actor(r *http.Request) (schoolID, userID string, err error) {
	claims, ok := kit.ClaimsFrom(r.Context())
	if !ok {
		return "", "", kit.Unauthorized("Missing service token.")
	}
	return claims.SchoolID, claims.Subject, nil
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	schoolID, _, err := actor(r)
	if err != nil {
		return err
	}
	var in CreateInput
	if err := kit.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	n, created, err := h.svc.Create(r.Context(), schoolID, in)
	if err != nil {
		return err
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	kit.WriteJSON(w, status, n)
	return nil
}

func (h *Handler) inbox(w http.ResponseWriter, r *http.Request) error {
	schoolID, userID, err := actor(r)
	if err != nil {
		return err
	}
	limit := 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if limit, err = strconv.Atoi(raw); err != nil || limit < 1 {
			return kit.Validation("limit must be between 1 and 100.", map[string]string{"limit": "1-100"})
		}
	}
	page, err := h.svc.Inbox(r.Context(), schoolID, userID, limit, r.URL.Query().Get("cursor"))
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, page)
	return nil
}

func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) error {
	schoolID, userID, err := actor(r)
	if err != nil {
		return err
	}
	if err := h.svc.MarkRead(r.Context(), schoolID, userID, chi.URLParam(r, "id")); err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, map[string]bool{"read": true})
	return nil
}

func (h *Handler) getPreferences(w http.ResponseWriter, r *http.Request) error {
	schoolID, userID, err := actor(r)
	if err != nil {
		return err
	}
	prefs, err := h.svc.Preferences(r.Context(), schoolID, userID)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, map[string]any{"preferences": prefs})
	return nil
}

func (h *Handler) putPreferences(w http.ResponseWriter, r *http.Request) error {
	schoolID, userID, err := actor(r)
	if err != nil {
		return err
	}
	var in struct {
		Preferences []Preference `json:"preferences"`
	}
	if err := kit.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	prefs, err := h.svc.SavePreferences(r.Context(), schoolID, userID, in.Preferences)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, map[string]any{"preferences": prefs})
	return nil
}

func (h *Handler) deliveries(w http.ResponseWriter, r *http.Request) error {
	schoolID, _, err := actor(r)
	if err != nil {
		return err
	}
	id := chi.URLParam(r, "id")
	counts, err := h.svc.DeliveryCounts(r.Context(), schoolID, id)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, map[string]any{"notificationId": id, "counts": counts})
	return nil
}

func (h *Handler) callback(w http.ResponseWriter, r *http.Request) error {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxCallbackBytes))
	if err != nil {
		return kit.Validation("Request body could not be read.", nil)
	}
	provider := chi.URLParam(r, "provider")
	headers := map[string]string{}
	for name := range r.Header {
		headers[strings.ToLower(name)] = r.Header.Get(name)
	}
	if err := h.verifier.Verify(provider, headers, body); err != nil {
		return kit.Unauthorized("Invalid callback signature.")
	}
	out, err := h.svc.RecordCallback(r.Context(), provider, headers, body)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, map[string]any{"received": true, "matched": out.Matched, "duplicate": out.Duplicate})
	return nil
}
