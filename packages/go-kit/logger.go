package kit

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"runtime/debug"
	"time"
)

const loggerKey ctxKey = "logger"

// NewLogger returns a JSON slog logger tagged with the service name.
func NewLogger(service string) *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", service)
}

// LoggerFrom returns the request logger from ctx, falling back to the default logger.
func LoggerFrom(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(loggerKey).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (s *statusWriter) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// LoggingMiddleware puts a requestId-tagged logger in ctx and logs one line per request.
func LoggingMiddleware(base *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			l := base.With("requestId", RequestID(r.Context()))
			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(sw, r.WithContext(context.WithValue(r.Context(), loggerKey, l)))
			l.Info("request", "method", r.Method, "path", r.URL.Path, "status", sw.status, "ms", time.Since(start).Milliseconds())
		})
	}
}

// RecoverMiddleware turns a panic into a logged 500 envelope without leaking internals.
func RecoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			rec := recover()
			if rec == nil {
				return
			}
			if rec == http.ErrAbortHandler {
				panic(rec) // net/http uses this value to abort a response on purpose
			}
			LoggerFrom(r.Context()).Error("panic", "panic", rec, "stack", string(debug.Stack()))
			WriteError(w, r, Internal())
		}()
		next.ServeHTTP(w, r)
	})
}
