# Database operations

## Current database and schema

Tradify uses Drizzle ORM and a `pg` connection pool. The API runtime prefers
`NEON_DATABASE_URL` when configured and otherwise falls back to Replit's
managed `DATABASE_URL`. Drizzle schema tooling and isolated test setup continue
to use `DATABASE_URL`, keeping development schema operations separate from the
runtime database. The schema source of truth is `lib/db/src/schema/`.

Current tables:

- Accounts and access: `tradify_users`, `tradify_staff_access`,
  `tradify_password_reset_tokens`, `tradify_account_deletion_requests`,
  `tradify_admin_audit_events`
- Billing and operations: `tradify_revenuecat_transfers`,
  `tradify_operational_alert_windows`, `tradify_sign_in_rate_limits`
- Control plane: `tradify_access_policies`, `tradify_engine_state`,
  `tradify_strategies`, `tradify_strategy_assignments`, `tradify_symbols`
- Market provider authority: `tradify_market_providers`,
  `tradify_market_provider_approvals`,
  `tradify_market_authority_decisions`,
  `tradify_market_authority_transitions`
- Market data: `tradify_mt5_bridge_state`, `tradify_mt5_candles`
- Signal history: `tradify_evaluation_history`, `tradify_generated_signals`,
  `tradify_signal_outcomes`

The schema defines primary keys for every table; unique constraints cover user
email, one generated signal per evaluation, and strategy-assignment identities.
Foreign keys connect password-reset tokens to users, evaluations to assignments,
signals to evaluations, outcomes to signals/evaluations, and assignments to
strategies/symbols. Domain checks constrain strategy lifecycle, staff roles, and
signal outcome status. Secondary indexes cover expiry, creation time, status,
symbol, strategy, assignment, and provider-authority lookups.

Soft deletion is present for users (`deleted_at`); symbols use `archived_at`.
Append-only audit/evaluation/history tables keep creation timestamps. Mutable
control-plane and market records carry update timestamps. Legacy tables use
some text-based timestamp columns while newer tables use `timestamptz`; those
types were not rewritten because doing so requires a reviewed data conversion.

## Schema change and migration workflow

Development schema changes continue to use Replit-managed PostgreSQL. Its
supported migration path is schema-as-code plus Replit's database diff:

1. Edit and review `lib/db/src/schema/` in Git.
2. Apply and verify the schema in the development database with
   `pnpm --filter @workspace/db run push`.
3. The post-merge setup runs `push-force` against development only.
4. Publish computes the development-to-production schema diff and applies it
   to production. Review any rename or destructive-change confirmation in the
   Publish UI before accepting it.

Do not run Drizzle push, custom DDL, or startup-time schema changes against
production. Replit Publish is the production schema migration mechanism for
this managed database. There is no checked-in SQL migration history; no schema
change or migration was created during this database review.

## Development-only seed

The API package has an opt-in seed command for the application's idempotent
reference/control-plane initialization. It creates no sample users or
credentials. It refuses to run unless `NODE_ENV=development`,
`TRADIFY_ALLOW_DEV_SEED=1`, and no Replit deployment marker is present:

```sh
NODE_ENV=development TRADIFY_ALLOW_DEV_SEED=1 pnpm --filter @workspace/api-server run db:seed:dev
```

The command was not run during this review.

## Backups and restore

Replit-managed production PostgreSQL provides scheduled daily restore points
(around midnight in the workspace's local time) and point-in-time restore.
Documented retention is 7 days on Core and up to 28 days on Pro/Enterprise;
confirm the current plan's retention in the Database pane.

- To restore production, open the Database pane, choose the production
  database, open restore settings, and select a restore point or timestamp
  within the available retention window.
- Before restoring, preserve any newer data that must be retained. A restore
  changes database contents; it does not restore application code.
- To recover development data, use the Database pane's rollback-to-checkpoint
  flow (checkpoint history is retained for up to 7 days). Development rollback
  does not restore production.

Treat a production restore as a data-changing operation: confirm the target and
time before proceeding, and export any post-restore-point data that must be
kept.
