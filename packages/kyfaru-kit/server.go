package kit

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

const shutdownTimeout = 10 * time.Second // lets in-flight requests finish on SIGTERM

// Config describes one service for NewRouter.
type Config struct {
	Name    string
	Version string
	Logger  *slog.Logger
	Checks  []Check
}

// NewRouter returns a chi router with request-id, logging, recover, /health, /ready and envelope 404/405.
func NewRouter(cfg Config) chi.Router {
	if cfg.Logger == nil {
		cfg.Logger = NewLogger(cfg.Name)
	}
	started := time.Now()
	r := chi.NewRouter()
	r.Use(RequestIDMiddleware, LoggingMiddleware(cfg.Logger), RecoverMiddleware)
	r.Get("/health", healthHandler(cfg.Name, cfg.Version, started))
	r.Get("/ready", readyHandler(cfg.Name, cfg.Version, cfg.Checks))
	r.NotFound(Handle(func(w http.ResponseWriter, r *http.Request) error { return NotFound("Route not found.") }))
	r.MethodNotAllowed(Handle(func(w http.ResponseWriter, r *http.Request) error {
		return newErr(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed.", nil)
	}))
	return r
}

// Serve runs handler on addr until ctx is cancelled, then shuts down gracefully.
func Serve(ctx context.Context, addr string, handler http.Handler, logger *slog.Logger) error {
	srv := &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()
	logger.Info("listening", "addr", addr)

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}
