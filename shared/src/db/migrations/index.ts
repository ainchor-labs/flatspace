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
  {
    id: 5,
    name: "tags",
    up: (db) => {
      // A shared, per-user tag vocabulary plus a polymorphic join. One tag can
      // label a document (Flatfile doc OR Flatdeck deck — both live in
      // `documents`), a Flatdrive file, or a Flatthoughts note. entity_id has no
      // real FK (it's polymorphic), so AFTER DELETE triggers clean orphaned
      // taggings — covering cascade deletes the app code never sees.
      db.exec(`
        CREATE TABLE tags (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name       TEXT NOT NULL,
          color      TEXT NOT NULL DEFAULT '#6366f1',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE UNIQUE INDEX idx_tags_owner_name ON tags(owner_id, name COLLATE NOCASE);

        CREATE TABLE taggings (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          entity_type TEXT NOT NULL CHECK (entity_type IN ('document', 'file', 'thought')),
          entity_id   INTEGER NOT NULL,
          owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (tag_id, entity_type, entity_id)
        );
        CREATE INDEX idx_taggings_entity ON taggings(entity_type, entity_id);
        CREATE INDEX idx_taggings_tag ON taggings(tag_id);
        CREATE INDEX idx_taggings_owner ON taggings(owner_id);

        CREATE TRIGGER trg_taggings_document_delete AFTER DELETE ON documents BEGIN
          DELETE FROM taggings WHERE entity_type = 'document' AND entity_id = OLD.id;
        END;
        CREATE TRIGGER trg_taggings_file_delete AFTER DELETE ON files BEGIN
          DELETE FROM taggings WHERE entity_type = 'file' AND entity_id = OLD.id;
        END;
        CREATE TRIGGER trg_taggings_thought_delete AFTER DELETE ON thoughts BEGIN
          DELETE FROM taggings WHERE entity_type = 'thought' AND entity_id = OLD.id;
        END;
      `);
    },
  },
  {
    id: 6,
    name: "file_starred",
    up: (db) => {
      // Flatdrive files gain a star flag, matching documents — powers the
      // Starred view in the file browser.
      db.exec(`
        ALTER TABLE files ADD COLUMN starred INTEGER NOT NULL DEFAULT 0;
      `);
    },
  },
  {
    id: 7,
    name: "api_keys",
    up: (db) => {
      // Per-user API keys for the programmatic REST API (/api/v1/*). The raw key
      // is shown once at creation and never stored — only a SHA-256 hash lives
      // here (key_hash, unique for O(1) bearer lookup). `prefix` is a short,
      // non-secret slice of the key kept for display so a user can tell their
      // keys apart and revoke the right one. `last_used_at` is bumped on use.
      db.exec(`
        CREATE TABLE api_keys (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name         TEXT NOT NULL DEFAULT 'API key',
          key_hash     TEXT NOT NULL UNIQUE,
          prefix       TEXT NOT NULL,
          last_used_at TEXT,
          created_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_api_keys_owner ON api_keys(owner_id);
      `);
    },
  },
  {
    id: 8,
    name: "user_dictionary",
    up: (db) => {
      // Per-user personal spelling dictionary: words the user has chosen to
      // "ignore" / add so the editor's spellchecker stops flagging them. Words
      // are stored lowercased; UNIQUE(owner_id, word) keeps adds idempotent.
      db.exec(`
        CREATE TABLE dictionary (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          word       TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(owner_id, word)
        );
        CREATE INDEX idx_dictionary_owner ON dictionary(owner_id);
      `);
    },
  },
];
