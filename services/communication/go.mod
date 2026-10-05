module github.com/stackable/communication

go 1.25.0

require (
	github.com/go-chi/chi/v5 v5.3.2
	github.com/jackc/pgx/v5 v5.11.0
	github.com/stackable/kyfaru-kit v0.0.0
)

replace github.com/stackable/kyfaru-kit => ../../packages/kyfaru-kit
