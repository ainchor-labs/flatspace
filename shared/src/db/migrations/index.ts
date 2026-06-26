/**
 * Migration definitions for the Flatspace shared database.
 *
 * Each migration has a monotonically increasing `id`, a human name, and an `up`
 * function that receives the live DB handle. The runner (./runner.ts) applies
 * any migrations whose id is greater than the last-applied id, inside a
 * transaction, and records them in the `_migrations` bookkeeping table.
 *
 * Migrations are append-only: never edit a shipped migration, add a new one.
 */

import type { DB } from "../connection.ts";

export interface Migration {
  id: number;
  name: string;
  up: (db: DB) => void;
}

export const migrations: Migration[] = [
  {
    id: 1,
    name: "initial_schema",
    up: (db) => {
      db.exec(`
        CREATE TABLE users (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          username      TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role          TEXT NOT NULL DEFAULT 'member'
                        CHECK (role IN ('admin', 'member')),
          avatar_color  TEXT NOT NULL DEFAULT '#6366f1',
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE folders (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT NOT NULL,
          owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          parent_id  INTEGER REFERENCES folders(id) ON DELETE CASCADE,
          app        TEXT NOT NULL CHECK (app IN ('flatfile', 'flatdeck')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_folders_owner ON folders(owner_id);
        CREATE INDEX idx_folders_parent ON folders(parent_id);

        CREATE TABLE documents (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          title      TEXT NOT NULL DEFAULT 'Untitled',
          content    TEXT NOT NULL DEFAULT '',
          folder_id  INTEGER REFERENCES folders(id) ON DELETE SET NULL,
          owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          app        TEXT NOT NULL CHECK (app IN ('flatfile', 'flatdeck')),
          starred    INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_documents_owner ON documents(owner_id);
        CREATE INDEX idx_documents_folder ON documents(folder_id);
        CREATE INDEX idx_documents_app ON documents(app);

        CREATE TABLE permissions (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          level       TEXT NOT NULL CHECK (level IN ('view', 'edit')),
          UNIQUE (document_id, user_id)
        );

        CREATE TABLE versions (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          document_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          content_snapshot TEXT NOT NULL,
          author_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          label            TEXT,
          created_at       TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_versions_document ON versions(document_id);
      `);
    },
  },
  {
    id: 2,
    name: "document_settings",
    up: (db) => {
      // Per-document formatting settings (margins, default font/size) as JSON.
      db.exec(`
        ALTER TABLE documents ADD COLUMN settings TEXT NOT NULL DEFAULT '{}';
      `);
    },
  },
  {
    id: 3,
    name: "flatdrive_files",
    up: (db) => {
      // Flatdrive keeps its own folder hierarchy and a files metadata table.
      // (It deliberately does NOT reuse the shared `folders`/`documents` tables,
      // so no CHECK-constraint rebuild is needed.) File bytes live on disk,
      // keyed by storage_key; this table is the metadata index.
      db.exec(`
        CREATE TABLE drive_folders (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT NOT NULL,
          owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          parent_id  INTEGER REFERENCES drive_folders(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_drive_folders_owner ON drive_folders(owner_id);
        CREATE INDEX idx_drive_folders_parent ON drive_folders(parent_id);

        CREATE TABLE files (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT NOT NULL,
          owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          folder_id   INTEGER REFERENCES drive_folders(id) ON DELETE CASCADE,
          mime        TEXT NOT NULL DEFAULT 'application/octet-stream',
          size        INTEGER NOT NULL DEFAULT 0,
          storage_key TEXT NOT NULL UNIQUE,
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_files_owner ON files(owner_id);
        CREATE INDEX idx_files_folder ON files(folder_id);
      `);
    },
  },
  {
    id: 4,
    name: "flatthoughts",
    up: (db) => {
      // Flatthoughts: quick markdown notes. Like Flatdrive, it keeps its own
      // table rather than reusing `documents` (whose `app` CHECK would need a
      // rebuild). `reviewed_at` is bumped when a thought is kept in triage mode.
      db.exec(`
        CREATE TABLE thoughts (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          title       TEXT NOT NULL DEFAULT '',
          content     TEXT NOT NULL DEFAULT '',
          owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reviewed_at TEXT,
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_thoughts_owner ON thoughts(owner_id);
      `);
    },
  },
];
