/**
 * Typed query helpers over the shared SQLite database.
 *
 * All SQL lives here so routes/services never write raw SQL. Each helper maps
 * snake_case DB rows into the camelCase domain types from `@flatspace/shared/types`.
 */

import type { DB } from "./connection.ts";
import { getDb } from "./connection.ts";
import type {
  AppId,
  Document,
  DocumentSettings,
  DocumentSummary,
  DriveFolder,
  FileItem,
  Folder,
  User,
  UserRole,
  UserRow,
  Version,
  VersionSummary,
} from "../types/index.ts";

/* ------------------------------------------------------------------ */
/* Row shapes (as returned by SQLite)                                 */
/* ------------------------------------------------------------------ */

interface UserRecord {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  avatar_color: string;
  created_at: string;
}

interface FolderRecord {
  id: number;
  name: string;
  owner_id: number;
  parent_id: number | null;
  app: AppId;
  created_at: string;
}

interface DocumentRecord {
  id: number;
  title: string;
  content: string;
  folder_id: number | null;
  owner_id: number;
  app: AppId;
  starred: number;
  settings: string;
  created_at: string;
  updated_at: string;
}

interface VersionRecord {
  id: number;
  document_id: number;
  content_snapshot: string;
  author_id: number;
  label: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Mappers                                                            */
/* ------------------------------------------------------------------ */

function toUserRow(r: UserRecord): UserRow {
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    role: r.role,
    avatarColor: r.avatar_color,
    createdAt: r.created_at,
  };
}

/** Strip the password hash for safe client exposure. */
export function toPublicUser(u: UserRow): User {
  const { passwordHash: _passwordHash, ...rest } = u;
  return rest;
}

function toFolder(r: FolderRecord): Folder {
  return {
    id: r.id,
    name: r.name,
    ownerId: r.owner_id,
    parentId: r.parent_id,
    app: r.app,
    createdAt: r.created_at,
  };
}

function parseSettings(raw: string): DocumentSettings {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as DocumentSettings) : {};
  } catch {
    return {};
  }
}

function toDocument(r: DocumentRecord): Document {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    folderId: r.folder_id,
    ownerId: r.owner_id,
    app: r.app,
    starred: r.starred === 1,
    settings: parseSettings(r.settings),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toSummary(d: Document): DocumentSummary {
  const { content: _content, ...rest } = d;
  return rest;
}

function toVersion(r: VersionRecord): Version {
  return {
    id: r.id,
    documentId: r.document_id,
    contentSnapshot: r.content_snapshot,
    authorId: r.author_id,
    label: r.label,
    createdAt: r.created_at,
  };
}

function toVersionSummary(v: Version): VersionSummary {
  const { contentSnapshot: _contentSnapshot, ...rest } = v;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */

export const users = {
  findByUsername(username: string, db: DB = getDb()): UserRow | null {
    const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
      | UserRecord
      | undefined;
    return row ? toUserRow(row) : null;
  },

  findById(id: number, db: DB = getDb()): UserRow | null {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | UserRecord
      | undefined;
    return row ? toUserRow(row) : null;
  },

  count(db: DB = getDb()): number {
    const row = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    return row.n;
  },

  create(
    input: { username: string; passwordHash: string; role: UserRole; avatarColor: string },
    db: DB = getDb(),
  ): UserRow {
    const info = db
      .prepare(
        "INSERT INTO users (username, password_hash, role, avatar_color) VALUES (?, ?, ?, ?)",
      )
      .run(input.username, input.passwordHash, input.role, input.avatarColor);
    const created = this.findById(Number(info.lastInsertRowid), db);
    if (!created) throw new Error("Failed to load user after insert");
    return created;
  },

  list(db: DB = getDb()): User[] {
    const rows = db.prepare("SELECT * FROM users ORDER BY username").all() as UserRecord[];
    return rows.map(toUserRow).map(toPublicUser);
  },

  /** Number of admins — used to refuse demoting/deleting the last one. */
  countAdmins(db: DB = getDb()): number {
    const row = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as {
      n: number;
    };
    return row.n;
  },

  updateRole(id: number, role: UserRole, db: DB = getDb()): void {
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  },

  updatePassword(id: number, passwordHash: string, db: DB = getDb()): void {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
  },

  updateAvatarColor(id: number, color: string, db: DB = getDb()): void {
    db.prepare("UPDATE users SET avatar_color = ? WHERE id = ?").run(color, id);
  },

  /** Delete a user; ON DELETE CASCADE clears their folders/docs/files/versions rows. */
  remove(id: number, db: DB = getDb()): void {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  },
};

/* ------------------------------------------------------------------ */
/* Folders                                                            */
/* ------------------------------------------------------------------ */

export const folders = {
  get(id: number, db: DB = getDb()): Folder | null {
    const row = db.prepare("SELECT * FROM folders WHERE id = ?").get(id) as FolderRecord | undefined;
    return row ? toFolder(row) : null;
  },

  listForUser(ownerId: number, app: AppId, db: DB = getDb()): Folder[] {
    const rows = db
      .prepare("SELECT * FROM folders WHERE owner_id = ? AND app = ? ORDER BY name")
      .all(ownerId, app) as FolderRecord[];
    return rows.map(toFolder);
  },

  create(
    input: { name: string; ownerId: number; parentId: number | null; app: AppId },
    db: DB = getDb(),
  ): Folder {
    const info = db
      .prepare("INSERT INTO folders (name, owner_id, parent_id, app) VALUES (?, ?, ?, ?)")
      .run(input.name, input.ownerId, input.parentId, input.app);
    const row = db.prepare("SELECT * FROM folders WHERE id = ?").get(info.lastInsertRowid) as
      | FolderRecord
      | undefined;
    if (!row) throw new Error("Failed to load folder after insert");
    return toFolder(row);
  },

  rename(id: number, name: string, db: DB = getDb()): void {
    db.prepare("UPDATE folders SET name = ? WHERE id = ?").run(name, id);
  },

  /** Delete a folder; its documents fall back to no-folder (ON DELETE SET NULL). */
  remove(id: number, db: DB = getDb()): void {
    db.prepare("DELETE FROM folders WHERE id = ?").run(id);
  },
};

/* ------------------------------------------------------------------ */
/* Documents                                                          */
/* ------------------------------------------------------------------ */

export const documents = {
  get(id: number, db: DB = getDb()): Document | null {
    const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as
      | DocumentRecord
      | undefined;
    return row ? toDocument(row) : null;
  },

  listForUser(
    ownerId: number,
    app: AppId,
    opts: { folderId?: number | null; starred?: boolean } = {},
    db: DB = getDb(),
  ): DocumentSummary[] {
    const clauses = ["owner_id = ?", "app = ?"];
    const params: unknown[] = [ownerId, app];

    if (opts.folderId !== undefined) {
      if (opts.folderId === null) clauses.push("folder_id IS NULL");
      else {
        clauses.push("folder_id = ?");
        params.push(opts.folderId);
      }
    }
    if (opts.starred) clauses.push("starred = 1");

    const rows = db
      .prepare(
        `SELECT * FROM documents WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC`,
      )
      .all(...params) as DocumentRecord[];
    return rows.map(toDocument).map(toSummary);
  },

  recent(ownerId: number, app: AppId, limit = 8, db: DB = getDb()): DocumentSummary[] {
    const rows = db
      .prepare(
        "SELECT * FROM documents WHERE owner_id = ? AND app = ? ORDER BY updated_at DESC LIMIT ?",
      )
      .all(ownerId, app, limit) as DocumentRecord[];
    return rows.map(toDocument).map(toSummary);
  },

  /** Full-text-ish search across title + content for one app. */
  search(ownerId: number, app: AppId, term: string, db: DB = getDb()): DocumentSummary[] {
    const like = `%${term}%`;
    const rows = db
      .prepare(
        `SELECT * FROM documents
         WHERE owner_id = ? AND app = ? AND (title LIKE ? OR content LIKE ?)
         ORDER BY updated_at DESC`,
      )
      .all(ownerId, app, like, like) as DocumentRecord[];
    return rows.map(toDocument).map(toSummary);
  },

  create(
    input: { title: string; ownerId: number; app: AppId; folderId: number | null; content?: string },
    db: DB = getDb(),
  ): Document {
    const info = db
      .prepare(
        "INSERT INTO documents (title, content, owner_id, app, folder_id) VALUES (?, ?, ?, ?, ?)",
      )
      .run(input.title, input.content ?? "", input.ownerId, input.app, input.folderId);
    const created = this.get(Number(info.lastInsertRowid), db);
    if (!created) throw new Error("Failed to load document after insert");
    return created;
  },

  /** Update title, content, and/or settings; always bumps updated_at. */
  update(
    id: number,
    fields: { title?: string; content?: string; settings?: DocumentSettings },
    db: DB = getDb(),
  ): Document | null {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.title !== undefined) {
      sets.push("title = ?");
      params.push(fields.title);
    }
    if (fields.content !== undefined) {
      sets.push("content = ?");
      params.push(fields.content);
    }
    if (fields.settings !== undefined) {
      sets.push("settings = ?");
      params.push(JSON.stringify(fields.settings));
    }
    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      params.push(id);
      db.prepare(`UPDATE documents SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    }
    return this.get(id, db);
  },

  setStarred(id: number, starred: boolean, db: DB = getDb()): void {
    db.prepare("UPDATE documents SET starred = ? WHERE id = ?").run(starred ? 1 : 0, id);
  },

  /** Move a document into a folder (null = top level); bumps updated_at. */
  move(id: number, folderId: number | null, db: DB = getDb()): void {
    db.prepare("UPDATE documents SET folder_id = ?, updated_at = datetime('now') WHERE id = ?").run(
      folderId,
      id,
    );
  },

  /** Delete a document; ON DELETE CASCADE removes its version history. */
  remove(id: number, db: DB = getDb()): void {
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  },
};

/* ------------------------------------------------------------------ */
/* Versions (document history snapshots)                              */
/* ------------------------------------------------------------------ */

export const versions = {
  /** History for a document, newest first, without the (large) snapshot blobs. */
  listForDocument(documentId: number, db: DB = getDb()): VersionSummary[] {
    const rows = db
      .prepare("SELECT * FROM versions WHERE document_id = ? ORDER BY created_at DESC, id DESC")
      .all(documentId) as VersionRecord[];
    return rows.map(toVersion).map(toVersionSummary);
  },

  /** A single version including its content snapshot. */
  get(id: number, db: DB = getDb()): Version | null {
    const row = db.prepare("SELECT * FROM versions WHERE id = ?").get(id) as
      | VersionRecord
      | undefined;
    return row ? toVersion(row) : null;
  },

  create(
    input: { documentId: number; contentSnapshot: string; authorId: number; label?: string | null },
    db: DB = getDb(),
  ): Version {
    const info = db
      .prepare(
        "INSERT INTO versions (document_id, content_snapshot, author_id, label) VALUES (?, ?, ?, ?)",
      )
      .run(input.documentId, input.contentSnapshot, input.authorId, input.label ?? null);
    const created = this.get(Number(info.lastInsertRowid), db);
    if (!created) throw new Error("Failed to load version after insert");
    return created;
  },

  /**
   * Whether a snapshot was recorded for this document within the last N minutes.
   * Drives throttled auto-snapshotting so debounced autosave doesn't spam history.
   */
  hasRecent(documentId: number, withinMinutes: number, db: DB = getDb()): boolean {
    const row = db
      .prepare(
        "SELECT 1 FROM versions WHERE document_id = ? AND created_at > datetime('now', ?) LIMIT 1",
      )
      .get(documentId, `-${withinMinutes} minutes`);
    return row !== undefined;
  },
};

/* ------------------------------------------------------------------ */
/* Flatdrive: folders + files                                         */
/* ------------------------------------------------------------------ */

interface DriveFolderRecord {
  id: number;
  name: string;
  owner_id: number;
  parent_id: number | null;
  created_at: string;
}

interface FileRecord {
  id: number;
  name: string;
  owner_id: number;
  folder_id: number | null;
  mime: string;
  size: number;
  storage_key: string;
  created_at: string;
  updated_at: string;
}

function toDriveFolder(r: DriveFolderRecord): DriveFolder {
  return { id: r.id, name: r.name, ownerId: r.owner_id, parentId: r.parent_id, createdAt: r.created_at };
}

function toFileItem(r: FileRecord): FileItem {
  return {
    id: r.id,
    name: r.name,
    ownerId: r.owner_id,
    folderId: r.folder_id,
    mime: r.mime,
    size: r.size,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** The bits the server needs to stream/delete a blob (never sent to clients). */
export interface FileLocation {
  id: number;
  ownerId: number;
  name: string;
  mime: string;
  size: number;
  storageKey: string;
}

export const driveFolders = {
  get(id: number, db: DB = getDb()): DriveFolder | null {
    const row = db.prepare("SELECT * FROM drive_folders WHERE id = ?").get(id) as
      | DriveFolderRecord
      | undefined;
    return row ? toDriveFolder(row) : null;
  },

  /** Direct children of a folder (parentId null = root), for one owner. */
  listChildren(ownerId: number, parentId: number | null, db: DB = getDb()): DriveFolder[] {
    const rows = (
      parentId === null
        ? db
            .prepare(
              "SELECT * FROM drive_folders WHERE owner_id = ? AND parent_id IS NULL ORDER BY name",
            )
            .all(ownerId)
        : db
            .prepare(
              "SELECT * FROM drive_folders WHERE owner_id = ? AND parent_id = ? ORDER BY name",
            )
            .all(ownerId, parentId)
    ) as DriveFolderRecord[];
    return rows.map(toDriveFolder);
  },

  /**
   * Root-to-folder path (inclusive), for breadcrumbs. Scoped to one owner: the
   * walk stops if it ever reaches a folder owned by someone else, so a crafted
   * parent chain can never leak another user's folder names.
   */
  breadcrumb(id: number, ownerId: number, db: DB = getDb()): DriveFolder[] {
    const path: DriveFolder[] = [];
    let cursor: number | null = id;
    const seen = new Set<number>();
    while (cursor !== null && !seen.has(cursor)) {
      seen.add(cursor);
      const folder: DriveFolder | null = this.get(cursor, db);
      if (!folder || folder.ownerId !== ownerId) break;
      path.unshift(folder);
      cursor = folder.parentId;
    }
    return path;
  },

  create(
    input: { name: string; ownerId: number; parentId: number | null },
    db: DB = getDb(),
  ): DriveFolder {
    const info = db
      .prepare("INSERT INTO drive_folders (name, owner_id, parent_id) VALUES (?, ?, ?)")
      .run(input.name, input.ownerId, input.parentId);
    const created = this.get(Number(info.lastInsertRowid), db);
    if (!created) throw new Error("Failed to load folder after insert");
    return created;
  },

  rename(id: number, name: string, db: DB = getDb()): void {
    db.prepare("UPDATE drive_folders SET name = ? WHERE id = ?").run(name, id);
  },

  move(id: number, parentId: number | null, db: DB = getDb()): void {
    db.prepare("UPDATE drive_folders SET parent_id = ? WHERE id = ?").run(parentId, id);
  },

  /**
   * True if `maybeDescendantId` is `rootId` or sits anywhere in the subtree
   * rooted at `rootId` — used to reject moves that would create a cycle.
   */
  isInSubtree(maybeDescendantId: number, rootId: number, db: DB = getDb()): boolean {
    let cursor: number | null = maybeDescendantId;
    const seen = new Set<number>();
    while (cursor !== null && !seen.has(cursor)) {
      if (cursor === rootId) return true;
      seen.add(cursor);
      cursor = this.get(cursor, db)?.parentId ?? null;
    }
    return false;
  },

  /** Delete a folder; ON DELETE CASCADE removes subfolders + file rows. */
  remove(id: number, db: DB = getDb()): void {
    db.prepare("DELETE FROM drive_folders WHERE id = ?").run(id);
  },
};

export const files = {
  listInFolder(ownerId: number, folderId: number | null, db: DB = getDb()): FileItem[] {
    const rows = (
      folderId === null
        ? db
            .prepare("SELECT * FROM files WHERE owner_id = ? AND folder_id IS NULL ORDER BY name")
            .all(ownerId)
        : db
            .prepare("SELECT * FROM files WHERE owner_id = ? AND folder_id = ? ORDER BY name")
            .all(ownerId, folderId)
    ) as FileRecord[];
    return rows.map(toFileItem);
  },

  get(id: number, db: DB = getDb()): FileItem | null {
    const row = db.prepare("SELECT * FROM files WHERE id = ?").get(id) as FileRecord | undefined;
    return row ? toFileItem(row) : null;
  },

  /** Server-only: storage key + metadata for streaming/deleting the blob. */
  location(id: number, db: DB = getDb()): FileLocation | null {
    const row = db.prepare("SELECT * FROM files WHERE id = ?").get(id) as FileRecord | undefined;
    if (!row) return null;
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      mime: row.mime,
      size: row.size,
      storageKey: row.storage_key,
    };
  },

  create(
    input: {
      name: string;
      ownerId: number;
      folderId: number | null;
      mime: string;
      size: number;
      storageKey: string;
    },
    db: DB = getDb(),
  ): FileItem {
    const info = db
      .prepare(
        "INSERT INTO files (name, owner_id, folder_id, mime, size, storage_key) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(input.name, input.ownerId, input.folderId, input.mime, input.size, input.storageKey);
    const created = this.get(Number(info.lastInsertRowid), db);
    if (!created) throw new Error("Failed to load file after insert");
    return created;
  },

  rename(id: number, name: string, db: DB = getDb()): void {
    db.prepare("UPDATE files SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
  },

  move(id: number, folderId: number | null, db: DB = getDb()): void {
    db.prepare("UPDATE files SET folder_id = ?, updated_at = datetime('now') WHERE id = ?").run(
      folderId,
      id,
    );
  },

  remove(id: number, db: DB = getDb()): void {
    db.prepare("DELETE FROM files WHERE id = ?").run(id);
  },

  search(ownerId: number, term: string, db: DB = getDb()): FileItem[] {
    const rows = db
      .prepare("SELECT * FROM files WHERE owner_id = ? AND name LIKE ? ORDER BY updated_at DESC")
      .all(ownerId, `%${term}%`) as FileRecord[];
    return rows.map(toFileItem);
  },

  /** Every file owned by a user — for blob cleanup before deleting the account. */
  allForOwner(ownerId: number, db: DB = getDb()): FileLocation[] {
    const rows = db
      .prepare("SELECT * FROM files WHERE owner_id = ?")
      .all(ownerId) as FileRecord[];
    return rows.map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      name: r.name,
      mime: r.mime,
      size: r.size,
      storageKey: r.storage_key,
    }));
  },

  /** All files within a folder subtree (inclusive) — for blob cleanup on folder delete. */
  allUnderFolder(ownerId: number, rootFolderId: number, db: DB = getDb()): FileLocation[] {
    const rows = db
      .prepare(
        `WITH RECURSIVE sub(id) AS (
           SELECT id FROM drive_folders WHERE id = ?
           UNION ALL
           SELECT df.id FROM drive_folders df JOIN sub ON df.parent_id = sub.id
         )
         SELECT * FROM files WHERE owner_id = ? AND folder_id IN (SELECT id FROM sub)`,
      )
      .all(rootFolderId, ownerId) as FileRecord[];
    return rows.map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      name: r.name,
      mime: r.mime,
      size: r.size,
      storageKey: r.storage_key,
    }));
  },
};
