package webhooks

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	kit "github.com/stackable/go-kit"
)

// Handler exposes the webhook routes.
type Handler struct {
	svc *Service
}

// NewHandler builds a Handler over a Service.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Routes mounts POST /v1/webhooks/{provider}.
func (h *Handler) Routes(r chi.Router) {
	r.Post("/v1/webhooks/{provider}", kit.Handle(h.receive))
}

func (h *Handler) receive(w http.ResponseWriter, r *http.Request) error {
	var payload json.RawMessage
	if err := kit.DecodeJSON(w, r, &payload); err != nil {
		return err
	}
	duplicate, err := h.svc.Receive(r.Context(), chi.URLParam(r, "provider"), payload)
	if err != nil {
		return err
	}
	kit.WriteJSON(w, http.StatusOK, map[string]any{"received": true, "duplicate": duplicate})
	return nil
}
