package main

import (
	"context"
	"crypto/rand"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stackable/documents/internal/documents"
	kit "github.com/stackable/go-kit"
)

const (
	serviceName  = "documents"
	defaultPort  = "4007"
	defaultDir   = "./data/documents"
	workerPeriod = 2 * time.Second
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
	objects, local, err := buildObjects()
	if err != nil {
		return err
	}
	issuer := os.Getenv("SERVICE_TOKEN_ISSUER")
	if issuer == "" {
		issuer = "stackable-gateway"
	}
	verifier, err := kit.NewServiceTokenVerifierFromEnv(issuer, serviceName)
	if err != nil {
		return err
	}

	svc := documents.NewService(documents.Config{
		Store: store, Objects: objects,
		Renderers: map[documents.Format]documents.Renderer{
			documents.FormatPDF: documents.PDFRenderer{}, documents.FormatXLSX: documents.XLSXRenderer{},
		},
	})
	go svc.RunWorker(ctx, workerPeriod, logger)

	router := kit.NewRouter(kit.Config{Name: serviceName, Version: version, Logger: logger, Checks: checks})
	documents.NewHandler(svc, verifier, local).Routes(router)

	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}
	return kit.Serve(ctx, ":"+port, router, logger)
}

// buildStore uses Postgres when DATABASE_URL is set and an in-memory store only outside production.
func buildStore(ctx context.Context) (documents.Store, []kit.Check, func(), error) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		if os.Getenv("APP_ENV") == "production" {
			return nil, nil, nil, errors.New("DATABASE_URL is required in production")
		}
		unset := func(context.Context) error { return errors.New("DATABASE_URL not set") }
		return documents.NewMemoryStore(), []kit.Check{{Name: "database", Required: false, Fn: unset}}, func() {}, nil
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, nil, nil, err
	}
	return documents.NewPgStore(pool), []kit.Check{{Name: "database", Required: true, Fn: pool.Ping}}, pool.Close, nil
}

// buildObjects prefers R2 when configured; otherwise files go to DOCS_DIR with HMAC-signed links.
func buildObjects() (documents.ObjectStore, *documents.LocalStore, error) {
	r2, err := documents.NewS3StoreFromEnv()
	if err != nil {
		return nil, nil, err
	}
	if r2 != nil {
		return r2, nil, nil
	}
	secret := []byte(os.Getenv("FILES_SIGNING_SECRET"))
	if len(secret) == 0 {
		if os.Getenv("APP_ENV") == "production" {
			return nil, nil, errors.New("FILES_SIGNING_SECRET is required in production")
		}
		secret = make([]byte, 32) // random per process in dev: links die on restart, never a known key
		_, _ = rand.Read(secret)
	}
	dir := os.Getenv("DOCS_DIR")
	if dir == "" {
		dir = defaultDir
	}
	local, err := documents.NewLocalStore(dir, secret, nil)
	return local, local, err
}
