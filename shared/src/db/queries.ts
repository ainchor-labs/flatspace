/**
 * Typed query helpers over the shared SQLite database.
 *
 * All SQL lives here so routes/services never write raw SQL. Each helper maps
 * snake_case DB rows into the camelCase domain types from `@flatspace/shared/types`.
 */

import type { DB } from "./connection.ts";
import { getDb } from "./connection.ts";
import type {
  ApiKey,
  AppId,
  Document,
  DocumentSettings,
  DocumentSummary,
  DriveFolder,
  FileItem,
  Folder,
  Tag,
  TagEntityType,
  TagWithCount,
  Thought,
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
    tags: [],
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
    return row ? fillTag("document", toDocument(row), db) : null;
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
    return fillTags("document", rows.map(toDocument).map(toSummary), db);
  },

  recent(ownerId: number, app: AppId, limit = 8, db: DB = getDb()): DocumentSummary[] {
    const rows = db
      .prepare(
        "SELECT * FROM documents WHERE owner_id = ? AND app = ? ORDER BY updated_at DESC LIMIT ?",
      )
      .all(ownerId, app, limit) as DocumentRecord[];
    return fillTags("document", rows.map(toDocument).map(toSummary), db);
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
    return fillTags("document", rows.map(toDocument).map(toSummary), db);
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
  starred: number;
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
    starred: r.starred === 1,
    tags: [],
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
    return fillTags("file", rows.map(toFileItem), db);
  },

  /** Every file owned by a user (across all folders), most-recently-updated first. */
  listAll(ownerId: number, opts: { starred?: boolean } = {}, db: DB = getDb()): FileItem[] {
    const clauses = ["owner_id = ?"];
    if (opts.starred) clauses.push("starred = 1");
    const rows = db
      .prepare(`SELECT * FROM files WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC`)
      .all(ownerId) as FileRecord[];
    return fillTags("file", rows.map(toFileItem), db);
  },

  /** The user's most recently updated files, regardless of folder. */
  recent(ownerId: number, limit = 24, db: DB = getDb()): FileItem[] {
    const rows = db
      .prepare("SELECT * FROM files WHERE owner_id = ? ORDER BY updated_at DESC LIMIT ?")
      .all(ownerId, limit) as FileRecord[];
    return fillTags("file", rows.map(toFileItem), db);
  },

  setStarred(id: number, starred: boolean, db: DB = getDb()): void {
    db.prepare("UPDATE files SET starred = ? WHERE id = ?").run(starred ? 1 : 0, id);
  },

  get(id: number, db: DB = getDb()): FileItem | null {
    const row = db.prepare("SELECT * FROM files WHERE id = ?").get(id) as FileRecord | undefined;
    return row ? fillTag("file", toFileItem(row), db) : null;
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
    return fillTags("file", rows.map(toFileItem), db);
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

/* ------------------------------------------------------------------ */
/* Flatthoughts: quick notes                                          */
/* ------------------------------------------------------------------ */

interface ThoughtRecord {
  id: number;
  title: string;
  content: string;
  owner_id: number;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

function toThought(r: ThoughtRecord): Thought {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    ownerId: r.owner_id,
    reviewedAt: r.reviewed_at,
    tags: [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const thoughts = {
  get(id: number, db: DB = getDb()): Thought | null {
    const row = db.prepare("SELECT * FROM thoughts WHERE id = ?").get(id) as
      | ThoughtRecord
      | undefined;
    return row ? fillTag("thought", toThought(row), db) : null;
  },

  /** All of a user's thoughts, most-recently-updated first. */
  listForUser(ownerId: number, db: DB = getDb()): Thought[] {
    const rows = db
      .prepare("SELECT * FROM thoughts WHERE owner_id = ? ORDER BY updated_at DESC")
      .all(ownerId) as ThoughtRecord[];
    return fillTags("thought", rows.map(toThought), db);
  },

  /**
   * The triage (swipe) deck: least-recently-reviewed first (never-reviewed lead),
   * tie-broken by oldest creation — so stale thoughts surface for keep/toss.
   */
  forReview(ownerId: number, db: DB = getDb()): Thought[] {
    const rows = db
      .prepare(
        `SELECT * FROM thoughts WHERE owner_id = ?
         ORDER BY reviewed_at IS NOT NULL, reviewed_at ASC, created_at ASC`,
      )
      .all(ownerId) as ThoughtRecord[];
    return fillTags("thought", rows.map(toThought), db);
  },

  search(ownerId: number, term: string, db: DB = getDb()): Thought[] {
    const like = `%${term}%`;
    const rows = db
      .prepare(
        `SELECT * FROM thoughts
         WHERE owner_id = ? AND (title LIKE ? OR content LIKE ?)
         ORDER BY updated_at DESC`,
      )
      .all(ownerId, like, like) as ThoughtRecord[];
    return fillTags("thought", rows.map(toThought), db);
  },

  create(
    input: { ownerId: number; title?: string; content?: string },
    db: DB = getDb(),
  ): Thought {
    const info = db
      .prepare("INSERT INTO thoughts (title, content, owner_id) VALUES (?, ?, ?)")
      .run(input.title ?? "", input.content ?? "", input.ownerId);
    const created = this.get(Number(info.lastInsertRowid), db);
    if (!created) throw new Error("Failed to load thought after insert");
    return created;
  },

  /** Update title and/or content; always bumps updated_at. */
  update(
    id: number,
    fields: { title?: string; content?: string },
    db: DB = getDb(),
  ): Thought | null {
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
    if (sets.length > 0) {
      sets.push("updated_at = datetime('now')");
      params.push(id);
      db.prepare(`UPDATE thoughts SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    }
    return this.get(id, db);
  },

  /** Stamp reviewed_at — called when a thought is "kept" in triage mode. */
  markReviewed(id: number, db: DB = getDb()): Thought | null {
    db.prepare("UPDATE thoughts SET reviewed_at = datetime('now') WHERE id = ?").run(id);
    return this.get(id, db);
  },

  remove(id: number, db: DB = getDb()): void {
    db.prepare("DELETE FROM thoughts WHERE id = ?").run(id);
  },
};

/* ------------------------------------------------------------------ */
/* Tags + taggings (shared, polymorphic labels)                       */
/* ------------------------------------------------------------------ */

interface TagRecord {
  id: number;
  owner_id: number;
  name: string;
  color: string;
  created_at: string;
}

function toTag(r: TagRecord): Tag {
  return { id: r.id, ownerId: r.owner_id, name: r.name, color: r.color, createdAt: r.created_at };
}

/** The physical table backing each polymorphic entity type. */
const ENTITY_TABLE: Record<TagEntityType, string> = {
  document: "documents",
  file: "files",
  thought: "thoughts",
};

/** Tags on a single entity, alphabetical. */
function tagsForEntity(entityType: TagEntityType, entityId: number, db: DB): Tag[] {
  const rows = db
    .prepare(
      `SELECT t.* FROM taggings tg JOIN tags t ON t.id = tg.tag_id
       WHERE tg.entity_type = ? AND tg.entity_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(entityType, entityId) as TagRecord[];
  return rows.map(toTag);
}

/** Tags for many entities of one type, as a Map keyed by entity id (one query). */
function tagMapFor(entityType: TagEntityType, ids: number[], db: DB): Map<number, Tag[]> {
  const map = new Map<number, Tag[]>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT tg.entity_id AS eid, t.* FROM taggings tg JOIN tags t ON t.id = tg.tag_id
       WHERE tg.entity_type = ? AND tg.entity_id IN (${placeholders})
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(entityType, ...ids) as (TagRecord & { eid: number })[];
  for (const row of rows) {
    const list = map.get(row.eid) ?? [];
    list.push(toTag(row));
    map.set(row.eid, list);
  }
  return map;
}

/** Fill `.tags` on a single item (returns it for chaining). */
function fillTag<T extends { id: number; tags: Tag[] } | null>(
  entityType: TagEntityType,
  item: T,
  db: DB,
): T {
  if (item) item.tags = tagsForEntity(entityType, item.id, db);
  return item;
}

/** Fill `.tags` on a list of items in a single batched query. */
function fillTags<T extends { id: number; tags: Tag[] }>(
  entityType: TagEntityType,
  items: T[],
  db: DB,
): T[] {
  if (items.length === 0) return items;
  const map = tagMapFor(entityType, items.map((i) => i.id), db);
  for (const item of items) item.tags = map.get(item.id) ?? [];
  return items;
}

export const tags = {
  get(id: number, db: DB = getDb()): Tag | null {
    const row = db.prepare("SELECT * FROM tags WHERE id = ?").get(id) as TagRecord | undefined;
    return row ? toTag(row) : null;
  },

  /** A user's tags (alphabetical) with how many items currently carry each. */
  listForUser(ownerId: number, db: DB = getDb()): TagWithCount[] {
    const rows = db
      .prepare(
        `SELECT t.*, COUNT(tg.id) AS count
         FROM tags t LEFT JOIN taggings tg ON tg.tag_id = t.id
         WHERE t.owner_id = ?
         GROUP BY t.id
         ORDER BY t.name COLLATE NOCASE`,
      )
      .all(ownerId) as (TagRecord & { count: number })[];
    return rows.map((r) => ({ ...toTag(r), count: r.count }));
  },

  /** Create a tag. Returns the existing one if the name already exists (case-insensitive). */
  create(input: { ownerId: number; name: string; color: string }, db: DB = getDb()): Tag {
    const existing = db
      .prepare("SELECT * FROM tags WHERE owner_id = ? AND name = ? COLLATE NOCASE")
      .get(input.ownerId, input.name) as TagRecord | undefined;
    if (existing) return toTag(existing);
    const info = db
      .prepare("INSERT INTO tags (owner_id, name, color) VALUES (?, ?, ?)")
      .run(input.ownerId, input.name, input.color);
    const created = this.get(Number(info.lastInsertRowid), db);
    if (!created) throw new Error("Failed to load tag after insert");
    return created;
  },

  update(id: number, fields: { name?: string; color?: string }, db: DB = getDb()): Tag | null {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.name !== undefined) {
      sets.push("name = ?");
      params.push(fields.name);
    }
    if (fields.color !== undefined) {
      sets.push("color = ?");
      params.push(fields.color);
    }
    if (sets.length > 0) {
      params.push(id);
      db.prepare(`UPDATE tags SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    }
    return this.get(id, db);
  },

  /** Delete a tag; ON DELETE CASCADE removes its taggings. */
  remove(id: number, db: DB = getDb()): void {
    db.prepare("DELETE FROM tags WHERE id = ?").run(id);
  },
};

/* ------------------------------------------------------------------ */
/* API keys (programmatic access tokens)                              */
/* ------------------------------------------------------------------ */

interface ApiKeyRecord {
  id: number;
  owner_id: number;
  name: string;
  key_hash: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
}

function toApiKey(r: ApiKeyRecord): ApiKey {
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    prefix: r.prefix,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
  };
}

export const apiKeys = {
  get(id: number, db: DB = getDb()): ApiKey | null {
    const row = db.prepare("SELECT * FROM api_keys WHERE id = ?").get(id) as
      | ApiKeyRecord
      | undefined;
    return row ? toApiKey(row) : null;
  },

  /** A user's keys, newest first (never includes the hash/secret). */
  listForUser(ownerId: number, db: DB = getDb()): ApiKey[] {
    const rows = db
      .prepare("SELECT * FROM api_keys WHERE owner_id = ? ORDER BY created_at DESC, id DESC")
      .all(ownerId) as ApiKeyRecord[];
    return rows.map(toApiKey);
  },

  /** Resolve the owning user id from a key's SHA-256 hash (for bearer auth). */
  ownerByHash(keyHash: string, db: DB = getDb()): number | null {
    const row = db.prepare("SELECT id, owner_id FROM api_keys WHERE key_hash = ?").get(keyHash) as
      | { id: number; owner_id: number }
      | undefined;
    if (!row) return null;
    return row.owner_id;
  },

  /** Stamp last_used_at — called on each successful authenticated request. */
  touchByHash(keyHash: string, db: DB = getDb()): void {
    db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE key_hash = ?").run(keyHash);
  },

  create(
    input: { ownerId: number; name: string; keyHash: string; prefix: string },
    db: DB = getDb(),
  ): ApiKey {
    const info = db
      .prepare("INSERT INTO api_keys (owner_id, name, key_hash, prefix) VALUES (?, ?, ?, ?)")
      .run(input.ownerId, input.name, input.keyHash, input.prefix);
    const created = this.get(Number(info.lastInsertRowid), db);
    if (!created) throw new Error("Failed to load api key after insert");
    return created;
  },

  remove(id: number, db: DB = getDb()): void {
    db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);
  },
};

export const taggings = {
  forEntity: tagsForEntity,

  /** The owner of a taggable entity (null if it doesn't exist) — for access checks. */
  entityOwnerId(entityType: TagEntityType, entityId: number, db: DB = getDb()): number | null {
    const row = db
      .prepare(`SELECT owner_id FROM ${ENTITY_TABLE[entityType]} WHERE id = ?`)
      .get(entityId) as { owner_id: number } | undefined;
    return row ? row.owner_id : null;
  },

  /**
   * Replace an entity's full tag set with `tagIds`. Only tags owned by `ownerId`
   * are attached; unknown/foreign tag ids are ignored. Returns the resulting tags.
   */
  setForEntity(
    entityType: TagEntityType,
    entityId: number,
    ownerId: number,
    tagIds: number[],
    db: DB = getDb(),
  ): Tag[] {
    const existing = (
      db
        .prepare("SELECT tag_id FROM taggings WHERE entity_type = ? AND entity_id = ?")
        .all(entityType, entityId) as { tag_id: number }[]
    ).map((r) => r.tag_id);
    const have = new Set(existing);
    const want = new Set(tagIds);

    const del = db.prepare(
      "DELETE FROM taggings WHERE entity_type = ? AND entity_id = ? AND tag_id = ?",
    );
    for (const id of existing) if (!want.has(id)) del.run(entityType, entityId, id);

    const owns = db.prepare("SELECT 1 FROM tags WHERE id = ? AND owner_id = ?");
    const ins = db.prepare(
      "INSERT OR IGNORE INTO taggings (tag_id, entity_type, entity_id, owner_id) VALUES (?, ?, ?, ?)",
    );
    for (const id of tagIds) {
      if (have.has(id)) continue;
      if (owns.get(id, ownerId)) ins.run(id, entityType, entityId, ownerId);
    }
    return tagsForEntity(entityType, entityId, db);
  },
};

/* ------------------------------------------------------------------ */
/* Personal spelling dictionary                                        */
/* ------------------------------------------------------------------ */

export const dictionary = {
  /** A user's personal words (lowercased), alphabetical. */
  list(ownerId: number, db: DB = getDb()): string[] {
    return (
      db
        .prepare("SELECT word FROM dictionary WHERE owner_id = ? ORDER BY word")
        .all(ownerId) as { word: string }[]
    ).map((r) => r.word);
  },

  /** Add a word (idempotent). Returns the normalised word stored. */
  add(ownerId: number, word: string, db: DB = getDb()): string {
    const w = word.trim().toLowerCase();
    if (w) db.prepare("INSERT OR IGNORE INTO dictionary (owner_id, word) VALUES (?, ?)").run(ownerId, w);
    return w;
  },

  remove(ownerId: number, word: string, db: DB = getDb()): void {
    db.prepare("DELETE FROM dictionary WHERE owner_id = ? AND word = ?").run(ownerId, word.trim().toLowerCase());
  },
};
