package kit

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// TxBeginner is satisfied by *pgxpool.Pool.
type TxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// WithSchool runs fn in a transaction whose app.school_id is set, so RLS applies to every query in fn.
// The setting is transaction-local (set_config third arg true) and cannot leak to other pool users.
func WithSchool(ctx context.Context, pool TxBeginner, schoolID string, fn func(ctx context.Context, tx pgx.Tx) error) error {
	if schoolID == "" {
		return Validation("schoolId is required.", nil)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after a successful commit

	if _, err := tx.Exec(ctx, "select set_config('app.school_id', $1, true)", schoolID); err != nil {
		return fmt.Errorf("set app.school_id: %w", err)
	}
	if err := fn(ctx, tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
