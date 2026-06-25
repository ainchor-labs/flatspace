/**
 * SQLite connection factory (shared across all Flatspace apps).
 *
 * One better-sqlite3 handle is shared process-wide. WAL mode is enabled for
 * better concurrent read performance on the home server, and foreign keys are
 * enforced so the relational schema stays consistent.
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type DB = Database.Database;

let instance: DB | null = null;

/** Resolve the on-disk database path (override with FLATSPACE_DB_PATH). */
export function resolveDbPath(): string {
  const fromEnv = process.env.FLATSPACE_DB_PATH;
  return fromEnv ? resolve(fromEnv) : resolve(process.cwd(), "data", "flatspace.sqlite");
}

/** Open (or reuse) the shared database connection. */
export function getDb(): DB {
  if (instance) return instance;

  const path = resolveDbPath();
  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  instance = db;
  return db;
}

/** Close the connection (used in tests / graceful shutdown). */
export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
