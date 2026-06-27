/**
 * Programmatic REST API, mounted under /api/v1 by the root server.
 *
 * Unlike the per-app web routes (cookie-authenticated, tuned for the SPA), this
 * is a clean, stable CRUD surface for scripts and external clients. Every route
 * authenticates with an API key via `Authorization: Bearer <key>` (see
 * app.apiKeyGuard) and is scoped to that key's owner. Resources:
 *
 *   /api/v1/files      FlatFiles  — rich-text documents (documents app=flatfile)
 *   /api/v1/decks      FlatDecks  — slide decks      (documents app=flatdeck)
 *   /api/v1/drive      FlatDrive  — uploaded files / blobs
 *   /api/v1/thoughts   FlatThoughts — quick notes
 *
 * Every collection follows the same shape:
 *   GET    /            list (filters via query string)
 *   GET    /:id         fetch one
 *   POST   /            create        → 201 + the created resource
 *   PATCH  /:id         partial update
 *   DELETE /:id         delete        → 204
 */

import "@flatspace/shared/auth";
import type { FastifyPluginAsync } from "fastify";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { documents, folders, files, driveFolders, thoughts } from "@flatspace/shared/db";
import { saveStream, deleteBlob, filePath, FileTooLargeError } from "@flatspace/flatdrive/server";
import type { AppId, DocumentSettings } from "@flatspace/shared/types";
import { markdownTitle, htmlTitle, deckTitle } from "./titles.ts";

/* ------------------------------------------------------------------ */
/* Shared error helpers (the suite-wide { error, message, statusCode }) */
/* ------------------------------------------------------------------ */

function notFound(message = "Not found") {
  return { error: "NotFound", message, statusCode: 404 } as const;
}
function badRequest(message: string) {
  return { error: "BadRequest", message, statusCode: 400 } as const;
}

function safeName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, " ").trim() || "file";
}

/* ------------------------------------------------------------------ */
/* Documents (FlatFiles + FlatDecks share the `documents` table)       */
/* ------------------------------------------------------------------ */

/** CRUD for one document-backed app (flatfile or flatdeck). */
function documentApiRoutes(appId: AppId): FastifyPluginAsync {
  const label = appId === "flatdeck" ? "Deck" : "Document";
  // The title is derived from the content (FlatFiles: first line of the HTML;
  // FlatDecks: the title-slide text) unless the caller passes an explicit title.
  const deriveTitle = appId === "flatdeck" ? deckTitle : htmlTitle;

  /** A folder is a valid parent/destination only if it's this user's, this app's. */
  function ownsFolder(folderId: number, userId: number): boolean {
    const folder = folders.get(folderId);
    return folder !== null && folder.ownerId === userId && folder.app === appId;
  }

  return async (app) => {
    // List (?folderId=&starred=&q=). With q, runs a title+content search.
    app.get("/", async (request) => {
      const user = request.user!;
      const { folderId, starred, q } = request.query as {
        folderId?: string;
        starred?: string;
        q?: string;
      };
      if (q?.trim()) return documents.search(user.id, appId, q.trim());
      return documents.listForUser(user.id, appId, {
        folderId:
          folderId === undefined ? undefined : folderId === "null" ? null : Number(folderId),
        starred: starred === "true",
      });
    });

    app.get("/:id", async (request, reply) => {
      const user = request.user!;
      const id = Number((request.params as { id: string }).id);
      const doc = documents.get(id);
      if (!doc || doc.app !== appId || doc.ownerId !== user.id) {
        return reply.code(404).send(notFound(`${label} not found`));
      }
      return doc;
    });

    app.post("/", async (request, reply) => {
      const user = request.user!;
      const body = (request.body ?? {}) as {
        title?: string;
        content?: string;
        folderId?: number | null;
      };
      const folderId = body.folderId ?? null;
      if (folderId !== null && !ownsFolder(folderId, user.id)) {
        return reply.code(404).send(notFound("Folder not found"));
      }
      const content = typeof body.content === "string" ? body.content : "";
      const title = body.title?.trim() || deriveTitle(content) || "Untitled";
      const doc = documents.create({ title, ownerId: user.id, app: appId, folderId, content });
      return reply.code(201).send(doc);
    });

    app.patch("/:id", async (request, reply) => {
      const user = request.user!;
      const id = Number((request.params as { id: string }).id);
      const doc = documents.get(id);
      if (!doc || doc.app !== appId || doc.ownerId !== user.id) {
        return reply.code(404).send(notFound(`${label} not found`));
      }
      const body = (request.body ?? {}) as {
        title?: string;
        content?: string;
        settings?: DocumentSettings;
        folderId?: number | null;
        starred?: boolean;
      };

      if (body.folderId !== undefined) {
        if (body.folderId !== null && !ownsFolder(body.folderId, user.id)) {
          return reply.code(404).send(notFound("Folder not found"));
        }
        documents.move(doc.id, body.folderId);
      }
      if (typeof body.starred === "boolean") documents.setStarred(doc.id, body.starred);

      // Explicit title wins; otherwise re-derive from the new content so the
      // title stays in sync with the first line / title slide.
      let title = body.title?.trim() ? body.title.trim() : undefined;
      if (title === undefined && body.content !== undefined) {
        title = deriveTitle(body.content) || "Untitled";
      }
      documents.update(doc.id, { title, content: body.content, settings: body.settings });
      return documents.get(doc.id);
    });

    app.delete("/:id", async (request, reply) => {
      const user = request.user!;
      const id = Number((request.params as { id: string }).id);
      const doc = documents.get(id);
      if (!doc || doc.app !== appId || doc.ownerId !== user.id) {
        return reply.code(404).send(notFound(`${label} not found`));
      }
      documents.remove(doc.id);
      return reply.code(204).send();
    });
  };
}

/* ------------------------------------------------------------------ */
/* FlatDrive (uploaded files / blobs)                                  */
/* ------------------------------------------------------------------ */

const driveApiRoutes: FastifyPluginAsync = async (app) => {
  function parseFolderId(raw: string | undefined): number | null {
    return raw == null || raw === "" || raw === "null" ? null : Number(raw);
  }

  // List (?folderId=&starred=&q=). q searches by name; folderId lists one folder.
  app.get("/", async (request) => {
    const user = request.user!;
    const { folderId, starred, q } = request.query as {
      folderId?: string;
      starred?: string;
      q?: string;
    };
    if (q?.trim()) return files.search(user.id, q.trim());
    if (folderId !== undefined) return files.listInFolder(user.id, parseFolderId(folderId));
    return files.listAll(user.id, { starred: starred === "true" });
  });

  app.get("/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const file = files.get(id);
    if (!file || file.ownerId !== user.id) return reply.code(404).send(notFound("File not found"));
    return file;
  });

  // Download the raw bytes. ?download forces an attachment disposition.
  app.get("/:id/raw", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const loc = files.location(id);
    if (!loc || loc.ownerId !== user.id) return reply.code(404).send(notFound("File not found"));

    const path = filePath(loc.storageKey);
    let total: number;
    try {
      total = statSync(path).size;
    } catch {
      return reply.code(404).send(notFound("File not found"));
    }
    const download = (request.query as { download?: string }).download != null;
    return reply
      .header("Content-Type", loc.mime)
      .header("Content-Length", total)
      .header(
        "Content-Disposition",
        `${download ? "attachment" : "inline"}; filename="${safeName(loc.name)}"`,
      )
      .send(createReadStream(path));
  });

  // Upload: the raw request body is the file bytes; name/folderId/mime ride in
  // the query string (matching the web upload route's transport).
  app.post("/", async (request, reply) => {
    const user = request.user!;
    const query = request.query as { folderId?: string; name?: string; mime?: string };
    const folderId = parseFolderId(query.folderId);
    if (folderId !== null) {
      const folder = driveFolders.get(folderId);
      if (!folder || folder.ownerId !== user.id) return reply.code(404).send(notFound("Folder not found"));
    }

    // Binary content-types stream straight through the root server's catch-all
    // parser; text/plain and application/json arrive already buffered, so wrap
    // those back into a stream. Either way saveStream gets a Readable.
    const raw = request.body;
    let source: Readable;
    if (raw && typeof (raw as Readable).pipe === "function") {
      source = raw as Readable;
    } else if (typeof raw === "string" || Buffer.isBuffer(raw)) {
      source = Readable.from(raw);
    } else {
      return reply.code(400).send(badRequest("Expected a file body"));
    }

    const name = safeName(query.name?.trim() || "upload");
    const mime = (query.mime || request.headers["content-type"] || "application/octet-stream")
      .split(";")[0]!
      .trim();

    try {
      const { storageKey, size } = await saveStream(source);
      const item = files.create({ name, ownerId: user.id, folderId, mime, size, storageKey });
      return reply.code(201).send(item);
    } catch (err) {
      if (err instanceof FileTooLargeError) {
        return reply.code(413).send({ error: "TooLarge", message: err.message, statusCode: 413 });
      }
      throw err;
    }
  });

  // Rename / move / star.
  app.patch("/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const file = files.get(id);
    if (!file || file.ownerId !== user.id) return reply.code(404).send(notFound("File not found"));

    const body = (request.body ?? {}) as {
      name?: string;
      folderId?: number | null;
      starred?: boolean;
    };
    if (body.name?.trim()) files.rename(id, safeName(body.name.trim()));
    if (Object.prototype.hasOwnProperty.call(body, "folderId")) {
      const target = body.folderId ?? null;
      if (target !== null) {
        const folder = driveFolders.get(target);
        if (!folder || folder.ownerId !== user.id) return reply.code(404).send(notFound("Folder not found"));
      }
      files.move(id, target);
    }
    if (typeof body.starred === "boolean") files.setStarred(id, body.starred);
    return files.get(id);
  });

  app.delete("/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const loc = files.location(id);
    if (!loc || loc.ownerId !== user.id) return reply.code(404).send(notFound("File not found"));
    await deleteBlob(loc.storageKey);
    files.remove(id);
    return reply.code(204).send();
  });
};

/* ------------------------------------------------------------------ */
/* FlatThoughts (quick notes)                                          */
/* ------------------------------------------------------------------ */

const thoughtsApiRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const user = request.user!;
    const { q } = request.query as { q?: string };
    if (q?.trim()) return thoughts.search(user.id, q.trim());
    return thoughts.listForUser(user.id);
  });

  app.get("/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const thought = thoughts.get(id);
    if (!thought || thought.ownerId !== user.id) return reply.code(404).send(notFound("Thought not found"));
    return thought;
  });

  app.post("/", async (request, reply) => {
    const user = request.user!;
    const body = (request.body ?? {}) as { title?: string; content?: string };
    const content = typeof body.content === "string" ? body.content : "";
    // Title defaults to the first line of the note (explicit title overrides).
    const title = body.title?.trim() || markdownTitle(content);
    const thought = thoughts.create({ ownerId: user.id, title, content });
    return reply.code(201).send(thought);
  });

  app.patch("/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const thought = thoughts.get(id);
    if (!thought || thought.ownerId !== user.id) return reply.code(404).send(notFound("Thought not found"));
    const body = (request.body ?? {}) as { title?: string; content?: string };
    // Explicit title wins; otherwise re-derive from the new content's first line.
    let title = body.title !== undefined ? body.title : undefined;
    if (title === undefined && body.content !== undefined) title = markdownTitle(body.content);
    return thoughts.update(thought.id, { title, content: body.content });
  });

  app.delete("/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const thought = thoughts.get(id);
    if (!thought || thought.ownerId !== user.id) return reply.code(404).send(notFound("Thought not found"));
    thoughts.remove(thought.id);
    return reply.code(204).send();
  });
};

/* ------------------------------------------------------------------ */
/* Mount: bearer auth on the whole tree, then the four collections     */
/* ------------------------------------------------------------------ */

export const apiV1Routes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.apiKeyGuard);

  // Who am I — handy for verifying a key works.
  app.get("/me", async (request) => request.user!);

  await app.register(documentApiRoutes("flatfile"), { prefix: "/files" });
  await app.register(documentApiRoutes("flatdeck"), { prefix: "/decks" });
  await app.register(driveApiRoutes, { prefix: "/drive" });
  await app.register(thoughtsApiRoutes, { prefix: "/thoughts" });
};
