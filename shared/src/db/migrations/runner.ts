/**
 * Migration runner.
 *
 * Applies pending migrations in id order, each in its own transaction, and
 * records applied ids in the `_migrations` table. Idempotent: running twice is a
 * no-op. Called automatically on server startup and via `pnpm migrate`.
 */

import type { DB } from "../connection.ts";
import { migrations, type Migration } from "./index.ts";

function ensureBookkeeping(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function appliedIds(db: DB): Set<number> {
  const rows = db.prepare("SELECT id FROM _migrations").all() as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

export interface MigrateResult {
  applied: Migration[];
  alreadyCurrent: boolean;
}

/** Run all pending migrations. Returns which ones were applied. */
export function runMigrations(db: DB): MigrateResult {
  ensureBookkeeping(db);
  const done = appliedIds(db);
  const pending = [...migrations].sort((a, b) => a.id - b.id).filter((m) => !done.has(m.id));

  const record = db.prepare("INSERT INTO _migrations (id, name) VALUES (?, ?)");

  for (const migration of pending) {
    const apply = db.transaction(() => {
      migration.up(db);
      record.run(migration.id, migration.name);
    });
    apply();
  }

  return { applied: pending, alreadyCurrent: pending.length === 0 };
}
