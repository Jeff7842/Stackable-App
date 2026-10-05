package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stackable/communication/internal/delivery"
	"github.com/stackable/communication/internal/notifications"
	kit "github.com/stackable/go-kit"
)

const (
	serviceName    = "communication"
	defaultPort    = "4006"
	tokenIssuer    = "stackable-gateway"
	defaultTZ      = "Africa/Nairobi" // quiet hours are in school local time
	defaultTickSec = 5
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	logger := kit.NewLogger(serviceName)
	if err := run(logger); err != nil {
		logger.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	tokens, err := kit.NewServiceTokenVerifierFromEnv(tokenIssuer, serviceName)
	if err != nil {
		return err
	}
	store, checks, closeDB, err := buildStore(ctx)
	if err != nil {
		return err
	}
	defer closeDB()

	loc, err := time.LoadLocation(envOr("QUIET_HOURS_TZ", defaultTZ))
	if err != nil {
		return err
	}
	tick, _ := strconv.Atoi(envOr("WORKER_INTERVAL_SECONDS", strconv.Itoa(defaultTickSec)))
	worker := delivery.NewWorker(store, buildAdapters(), delivery.WorkerConfig{Interval: time.Duration(tick) * time.Second, Location: loc}, logger)
	go worker.Run(ctx)

	var verifier notifications.SignatureVerifier = notifications.FakeVerifier{}
	if os.Getenv("APP_ENV") == "production" {
		verifier = notifications.FakeVerifier{Reject: true} // no real signature scheme is wired yet, so refuse in production
	}
	router := kit.NewRouter(kit.Config{Name: serviceName, Version: version, Logger: logger, Checks: checks})
	notifications.NewHandler(notifications.NewService(store), verifier).Routes(router, tokens)

	return kit.Serve(ctx, ":"+envOr("PORT", defaultPort), router, logger)
}

func envOr(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

// buildAdapters uses real providers when configured; outside production the fake fills any gap.
func buildAdapters() map[string]delivery.ChannelAdapter {
	resend, at := delivery.NewResendFromEnv(), delivery.NewAfricasTalkingFromEnv()
	prod := os.Getenv("APP_ENV") == "production"
	pick := func(real delivery.ChannelAdapter, enabled bool) delivery.ChannelAdapter {
		if enabled {
			return real
		}
		if prod {
			return delivery.DisabledAdapter{}
		}
		return delivery.NewFakeAdapter()
	}
	return map[string]delivery.ChannelAdapter{
		notifications.ChannelPush:  pick(nil, false), // push has no provider yet
		notifications.ChannelSMS:   pick(at, at.Enabled()),
		notifications.ChannelEmail: pick(resend, resend.Enabled()),
	}
}

// buildStore uses Postgres when DATABASE_URL is set and an in-memory store only outside production.
func buildStore(ctx context.Context) (notifications.Store, []kit.Check, func(), error) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		if os.Getenv("APP_ENV") == "production" {
			return nil, nil, nil, errors.New("DATABASE_URL is required in production")
		}
		unset := func(context.Context) error { return errors.New("DATABASE_URL not set") }
		return notifications.NewMemoryStore(), []kit.Check{{Name: "database", Required: false, Fn: unset}}, func() {}, nil
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, nil, nil, err
	}
	checks := []kit.Check{{Name: "database", Required: true, Fn: pool.Ping}}
	return notifications.NewPgStore(pool), checks, pool.Close, nil
}
