package main

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	kit "github.com/stackable/kyfaru-kit"
	"github.com/stackable/payments/internal/fees"
	"github.com/stackable/payments/internal/provider"
)

const (
	serviceName = "payments"
	defaultPort = "4005"
	tokenIssuer = "stackable-gateway"
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

	store, checks, closeDB, err := buildStore(ctx)
	if err != nil {
		return err
	}
	defer closeDB()

	router := kit.NewRouter(kit.Config{Name: serviceName, Version: version, Logger: logger, Checks: checks})
	verifier, err := kit.NewServiceTokenVerifierFromEnv(tokenIssuer, serviceName)
	if err != nil {
		return err // fail closed: never serve money routes without a token secret
	}
	fees.NewHandler(fees.NewService(store, buildProviders(logger)...)).Routes(router, kit.RequireServiceToken(verifier))

	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}
	return kit.Serve(ctx, ":"+port, router, logger)
}

// buildStore uses Postgres when DATABASE_URL is set and an in-memory store only outside production.
func buildStore(ctx context.Context) (fees.Store, []kit.Check, func(), error) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		if os.Getenv("APP_ENV") == "production" {
			return nil, nil, nil, errors.New("DATABASE_URL is required in production")
		}
		unset := func(context.Context) error { return errors.New("DATABASE_URL not set") }
		return fees.NewMemoryStore(), []kit.Check{{Name: "database", Required: false, Fn: unset}}, func() {}, nil
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, nil, nil, err
	}
	checks := []kit.Check{{Name: "database", Required: true, Fn: pool.Ping}}
	return fees.NewPgStore(pool), checks, pool.Close, nil
}

// buildProviders enables mpesa only when configured and the fake only outside production unless forced on.
func buildProviders(logger *slog.Logger) []provider.PaymentProvider {
	var out []provider.PaymentProvider
	if m, ok := provider.NewMpesaFromEnv(); ok {
		out = append(out, m)
	} else {
		logger.Warn("mpesa disabled: MPESA_* variables are not all set")
	}
	if os.Getenv("APP_ENV") != "production" || os.Getenv("ENABLE_FAKE_PROVIDER") == "true" {
		out = append(out, provider.Fake{})
	}
	return out
}
