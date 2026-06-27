/**
 * Shared domain types for the Flatspace Suite.
 *
 * Single source of truth for the shapes that cross the client/server boundary.
 * Server query helpers return these; the API client and React components consume
 * them. Keep this free of any runtime/Node/DOM dependency so it is safe to import
 * from anywhere (browser or server).
 */

export type AppId = "flatfile" | "flatdeck" | "flatdrive" | "flatthoughts";

export type UserRole = "admin" | "member";

/** The taggable entity kinds. `document` covers both Flatfile docs and Flatdeck decks. */
export type TagEntityType = "document" | "file" | "thought";

/** Curated tag colors (read well on the near-black UI). Client-safe. */
export const TAG_PALETTE = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f59e0b", // amber
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#94a3b8", // slate
] as const;

/** A per-user label. */
export interface Tag {
  id: number;
  ownerId: number;
  name: string;
  color: string;
  createdAt: string;
}

/** A tag plus how many items currently carry it (for the manager screen). */
export interface TagWithCount extends Tag {
  count: number;
}

export type PermissionLevel = "view" | "edit";

/**
 * Curated avatar colors (read well on the near-black UI). Single source of truth,
 * client-safe so both the profile picker and the server validator import it here.
 */
export const AVATAR_PALETTE = [
  "#6366f1", // indigo (brand)
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
] as const;

export interface User {
  id: number;
  username: string;
  role: UserRole;
  /** Hex color used for the avatar + live cursor badge. */
  avatarColor: string;
  createdAt: string;
}

/** A user record as stored in SQLite (includes the password hash — server only). */
export interface UserRow extends User {
  passwordHash: string;
}

export interface Folder {
  id: number;
  name: string;
  ownerId: number;
  parentId: number | null;
  app: AppId;
  createdAt: string;
}

export type MarginPreset = "narrow" | "normal" | "wide" | "full";

/** Per-document formatting settings (stored as JSON in documents.settings). */
export interface DocumentSettings {
  margin?: MarginPreset;
  /** Default font family for the whole document (CSS font-family value). */
  fontFamily?: string;
  /** Default font size for the whole document (CSS size, e.g. "16px"). */
  fontSize?: string;
}

export interface Document {
  id: number;
  title: string;
  content: string;
  folderId: number | null;
  ownerId: number;
  app: AppId;
  starred: boolean;
  settings: DocumentSettings;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

/** Document without the (potentially large) content blob — for list/browser views. */
export type DocumentSummary = Omit<Document, "content">;

export interface Permission {
  id: number;
  documentId: number;
  userId: number;
  level: PermissionLevel;
}

export interface Version {
  id: number;
  documentId: number;
  contentSnapshot: string;
  authorId: number;
  label: string | null;
  createdAt: string;
}

export type VersionSummary = Omit<Version, "contentSnapshot">;

/* ------------------------------------------------------------------ */
/* Flatdrive (file manager)                                            */
/* ------------------------------------------------------------------ */

/** A folder in Flatdrive's own hierarchy (separate from doc/deck folders). */
export interface DriveFolder {
  id: number;
  name: string;
  ownerId: number;
  parentId: number | null;
  createdAt: string;
}

/** An uploaded file. The bytes live on disk (keyed by storageKey); this is the metadata row. */
export interface FileItem {
  id: number;
  name: string;
  ownerId: number;
  folderId: number | null;
  mime: string;
  size: number;
  starred: boolean;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

/** A Flatdrive folder listing: the folder itself (null = root), its path, and contents. */
export interface DriveListing {
  folder: DriveFolder | null;
  breadcrumb: DriveFolder[];
  folders: DriveFolder[];
  files: FileItem[];
}

/* ------------------------------------------------------------------ */
/* Flatthoughts (quick notes)                                          */
/* ------------------------------------------------------------------ */

/**
 * A quick note. Content is markdown (rendered on the client). `reviewedAt` is
 * stamped each time a thought is "kept" in triage (swipe) mode, so the triage
 * deck can surface the least-recently-reviewed thoughts first.
 */
export interface Thought {
  id: number;
  title: string;
  content: string;
  ownerId: number;
  reviewedAt: string | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* API keys (programmatic access to /api/v1)                           */
/* ------------------------------------------------------------------ */

/**
 * A personal access token for the REST API. The secret itself is never stored
 * or returned after creation — only `prefix` (a short, non-secret slice) is kept
 * so the owner can identify a key in the list and revoke it.
 */
export interface ApiKey {
  id: number;
  ownerId: number;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/** Returned exactly once, at creation time: the full key in `key`. Store it now. */
export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}

/* ------------------------------------------------------------------ */
/* Auth DTOs                                                           */
/* ------------------------------------------------------------------ */

export interface Credentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
}

/** Decoded JWT payload stored in the httpOnly cookie. */
export interface JwtPayload {
  sub: number;
  username: string;
  role: UserRole;
}

/* ------------------------------------------------------------------ */
/* Generic API envelope                                               */
/* ------------------------------------------------------------------ */

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
