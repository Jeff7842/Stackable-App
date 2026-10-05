package kit

import (
	"context"
	"net/http"
	"sync"
	"time"
)

const checkTimeout = 2 * time.Second // a slow dependency must not hang the probe

// Check is one dependency probe; a failing Required check makes the service not ready.
type Check struct {
	Name     string
	Required bool
	Fn       func(ctx context.Context) error
}

type checkResult struct {
	Name      string `json:"name"`
	Required  bool   `json:"required"`
	Status    string `json:"status"`
	LatencyMs int64  `json:"latencyMs"`
}

func runCheck(ctx context.Context, c Check) checkResult {
	ctx, cancel := context.WithTimeout(ctx, checkTimeout)
	defer cancel()
	start := time.Now()
	status := "ok"
	if err := c.Fn(ctx); err != nil {
		LoggerFrom(ctx).Warn("readiness check failed", "check", c.Name, "err", err)
		status = "failed"
	}
	return checkResult{Name: c.Name, Required: c.Required, Status: status, LatencyMs: time.Since(start).Milliseconds()}
}

func healthHandler(name, version string, started time.Time) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]any{
			"status":        "ok",
			"name":          name,
			"version":       version,
			"uptimeSeconds": int64(time.Since(started).Seconds()),
		})
	}
}

func readyHandler(name, version string, checks []Check) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		results := make([]checkResult, len(checks))
		var wg sync.WaitGroup
		for i, c := range checks {
			wg.Add(1)
			go func() {
				defer wg.Done()
				results[i] = runCheck(r.Context(), c)
			}()
		}
		wg.Wait()

		status, code := "ready", http.StatusOK
		for _, res := range results {
			if res.Status == "ok" {
				continue
			}
			if res.Required {
				status, code = "unavailable", http.StatusServiceUnavailable
				break
			}
			status = "degraded"
		}
		WriteJSON(w, code, map[string]any{"status": status, "name": name, "version": version, "checks": results})
	}
}
