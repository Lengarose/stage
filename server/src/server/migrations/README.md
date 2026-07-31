# Startup Migrations

Startup migrations repair already-running databases when the Node process boots.
Fresh installs still use `server/schema.sql`; both must stay in sync.

`startupMigrations.js` owns:

- idempotent `CREATE TABLE IF NOT EXISTS` statements
- idempotent `addCol(table, column, definition)` changes
- index creation and safe index cleanup
- backfills from legacy data
- default config seeding when a table is empty

Rules:

- migrations must be safe to run repeatedly
- backfills need `NOT EXISTS` or another idempotency guard
- never rely on `INSERT IGNORE` unless a matching unique key exists
- log failures with enough context to debug production startup
- do not put request/response logic here
