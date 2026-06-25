/**
 * Flatfile API routes, mounted under /api/flatfile by the root server.
 *
 *   GET    /docs                list documents (?folderId=&starred=)
 *   GET    /docs/recent         recently updated documents
 *   GET    /docs/:id            full document (content included)
 *   POST   /docs                create a document
 *   PATCH  /docs/:id/star       toggle starred
 *   GET    /folders             list folders
 *   POST   /folders             create a folder
 *   GET    /search?q=           search title + content
 *   POST   /docs/:id/export     export the document as DOCX (via Pandoc)
 *   GET    /docs/:id/versions             list history snapshots
 *   GET    /docs/:id/versions/:vid        one snapshot (with content)
 *   POST   /docs/:id/versions/:vid/restore  roll back to a snapshot
 *
 * Every route requires auth (app.authGuard) and is scoped to the current user.
 */

import "@flatspace/shared/auth"; // pulls in FastifyRequest.user / app.authGuard augmentation
import type { FastifyPluginAsync } from "fastify";
import { documents, folders, versions } from "@flatspace/shared/db";
import { markdownToDocx, PandocMissingError } from "./export.ts";

const APP = "flatfile" as const;

/** A folder is usable as a parent/destination only if it's this user's Flatfile folder. */
function ownsFolder(folderId: number, userId: number): boolean {
  const folder = folders.get(folderId);
  return folder !== null && folder.ownerId === userId && folder.app === APP;
}

// Auto-snapshot the document into history at most once per this many minutes,
// so debounced autosave doesn't create a version on every keystroke.
const SNAPSHOT_THROTTLE_MIN = 10;

export const flatfileRoutes: FastifyPluginAsync = async (app) => {
  // Guard every route in this tree.
  app.addHook("preHandler", app.authGuard);

  app.get("/docs", async (request) => {
    const user = request.user!;
    const { folderId, starred } = request.query as { folderId?: string; starred?: string };
    return documents.listForUser(user.id, APP, {
      folderId: folderId === undefined ? undefined : folderId === "null" ? null : Number(folderId),
      starred: starred === "true",
    });
  });

  app.get("/docs/recent", async (request) => {
    const user = request.user!;
    return documents.recent(user.id, APP);
  });

  app.get("/docs/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const doc = documents.get(Number(id));
    if (!doc || doc.app !== APP) {
      return reply.code(404).send({ error: "NotFound", message: "Document not found", statusCode: 404 });
    }
    if (doc.ownerId !== user.id) {
      return reply.code(403).send({ error: "Forbidden", message: "No access", statusCode: 403 });
    }
    return doc;
  });

  app.post("/docs", async (request, reply) => {
    const user = request.user!;
    const body = (request.body ?? {}) as { title?: string; folderId?: number | null };
    const folderId = body.folderId ?? null;
    if (folderId !== null && !ownsFolder(folderId, user.id)) {
      return reply.code(404).send({ error: "NotFound", message: "Folder not found", statusCode: 404 });
    }
    const doc = documents.create({
      title: body.title?.trim() || "Untitled",
      ownerId: user.id,
      app: APP,
      folderId,
    });
    return reply.code(201).send(doc);
  });

  app.patch("/docs/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const doc = documents.get(Number(id));
    if (!doc || doc.app !== APP || doc.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Document not found", statusCode: 404 });
    }
    const body = (request.body ?? {}) as {
      title?: string;
      content?: string;
      settings?: import("@flatspace/shared/types").DocumentSettings;
      folderId?: number | null;
    };

    // Move into a folder (null = top level), validating the destination is the
    // user's own Flatfile folder.
    if (body.folderId !== undefined) {
      if (body.folderId !== null && !ownsFolder(body.folderId, user.id)) {
        return reply.code(404).send({ error: "NotFound", message: "Folder not found", statusCode: 404 });
      }
      documents.move(doc.id, body.folderId);
    }

    // Throttled history snapshot: when the content actually changes and we
    // haven't recorded a version recently, snapshot the prior content so the
    // pre-edit state is recoverable. The live document holds the latest state.
    if (
      body.content !== undefined &&
      body.content !== doc.content &&
      !versions.hasRecent(doc.id, SNAPSHOT_THROTTLE_MIN)
    ) {
      versions.create({ documentId: doc.id, contentSnapshot: doc.content, authorId: user.id });
    }

    const updated = documents.update(doc.id, {
      title: body.title?.trim() ? body.title.trim() : undefined,
      content: body.content,
      settings: body.settings,
    });
    return updated;
  });

  app.post("/docs/:id/duplicate", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const doc = documents.get(Number(id));
    if (!doc || doc.app !== APP || doc.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Document not found", statusCode: 404 });
    }
    const copy = documents.create({
      title: `${doc.title} (copy)`,
      ownerId: user.id,
      app: APP,
      folderId: doc.folderId,
      content: doc.content,
    });
    if (doc.settings) documents.update(copy.id, { settings: doc.settings });
    return reply.code(201).send(documents.get(copy.id));
  });

  app.delete("/docs/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const doc = documents.get(Number(id));
    if (!doc || doc.app !== APP || doc.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Document not found", statusCode: 404 });
    }
    documents.remove(doc.id);
    return reply.code(204).send();
  });

  app.patch("/docs/:id/star", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const doc = documents.get(Number(id));
    if (!doc || doc.app !== APP || doc.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Document not found", statusCode: 404 });
    }
    documents.setStarred(doc.id, !doc.starred);
    return { id: doc.id, starred: !doc.starred };
  });

  app.get("/folders", async (request) => {
    const user = request.user!;
    return folders.listForUser(user.id, APP);
  });

  app.post("/folders", async (request, reply) => {
    const user = request.user!;
    const body = (request.body ?? {}) as { name?: string; parentId?: number | null };
    if (!body.name?.trim()) {
      return reply.code(400).send({ error: "BadRequest", message: "Folder name required", statusCode: 400 });
    }
    const parentId = body.parentId ?? null;
    if (parentId !== null && !ownsFolder(parentId, user.id)) {
      return reply.code(404).send({ error: "NotFound", message: "Parent folder not found", statusCode: 404 });
    }
    const folder = folders.create({
      name: body.name.trim(),
      ownerId: user.id,
      app: APP,
      parentId,
    });
    return reply.code(201).send(folder);
  });

  app.patch("/folders/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const folder = folders.get(Number(id));
    if (!folder || folder.app !== APP || folder.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Folder not found", statusCode: 404 });
    }
    const body = (request.body ?? {}) as { name?: string };
    if (body.name?.trim()) folders.rename(folder.id, body.name.trim());
    return folders.get(folder.id);
  });

  app.delete("/folders/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const folder = folders.get(Number(id));
    if (!folder || folder.app !== APP || folder.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Folder not found", statusCode: 404 });
    }
    // Documents inside fall back to no-folder (ON DELETE SET NULL).
    folders.remove(folder.id);
    return reply.code(204).send();
  });

  app.get("/search", async (request) => {
    const user = request.user!;
    const { q } = request.query as { q?: string };
    if (!q?.trim()) return [];
    return documents.search(user.id, APP, q.trim());
  });

  // DOCX export. Markdown/TXT/PDF are produced entirely client-side; only DOCX
  // needs Pandoc, so the client sends its rendered markdown here for conversion.
  app.post("/docs/:id/export", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const doc = documents.get(Number(id));
    if (!doc || doc.app !== APP || doc.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Document not found", statusCode: 404 });
    }

    const body = (request.body ?? {}) as { format?: string; markdown?: string };
    if (body.format !== "docx") {
      return reply
        .code(400)
        .send({ error: "BadRequest", message: "Only the 'docx' format is exported server-side", statusCode: 400 });
    }
    if (typeof body.markdown !== "string") {
      return reply
        .code(400)
        .send({ error: "BadRequest", message: "Missing markdown content", statusCode: 400 });
    }

    try {
      const docx = await markdownToDocx(body.markdown);
      const filename = `${safeFilename(doc.title)}.docx`;
      return reply
        .header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(docx);
    } catch (err) {
      if (err instanceof PandocMissingError) {
        return reply.code(501).send({
          error: "NotImplemented",
          message: "DOCX export requires Pandoc, which is not installed on the server.",
          statusCode: 501,
        });
      }
      request.log.error(err, "DOCX export failed");
      return reply
        .code(500)
        .send({ error: "ExportFailed", message: "Failed to generate DOCX", statusCode: 500 });
    }
  });

  // Version history --------------------------------------------------------

  app.get("/docs/:id/versions", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const doc = documents.get(Number(id));
    if (!doc || doc.app !== APP || doc.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Document not found", statusCode: 404 });
    }
    return versions.listForDocument(doc.id);
  });

  app.get("/docs/:id/versions/:vid", async (request, reply) => {
    const user = request.user!;
    const { id, vid } = request.params as { id: string; vid: string };
    const doc = documents.get(Number(id));
    if (!doc || doc.app !== APP || doc.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Document not found", statusCode: 404 });
    }
    const version = versions.get(Number(vid));
    if (!version || version.documentId !== doc.id) {
      return reply.code(404).send({ error: "NotFound", message: "Version not found", statusCode: 404 });
    }
    return version;
  });

  app.post("/docs/:id/versions/:vid/restore", async (request, reply) => {
    const user = request.user!;
    const { id, vid } = request.params as { id: string; vid: string };
    const doc = documents.get(Number(id));
    if (!doc || doc.app !== APP || doc.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Document not found", statusCode: 404 });
    }
    const version = versions.get(Number(vid));
    if (!version || version.documentId !== doc.id) {
      return reply.code(404).send({ error: "NotFound", message: "Version not found", statusCode: 404 });
    }
    // Snapshot the current state first (bypassing the throttle) so restoring is
    // itself reversible, then roll the document back to the chosen version.
    if (doc.content !== version.contentSnapshot) {
      versions.create({
        documentId: doc.id,
        contentSnapshot: doc.content,
        authorId: user.id,
        label: "Before restore",
      });
    }
    const updated = documents.update(doc.id, { content: version.contentSnapshot });
    return updated;
  });
};

/** Turn a document title into a filesystem/header-safe filename stem. */
function safeFilename(title: string): string {
  const cleaned = title
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "") // strip path/header-hostile characters
    .replace(/\s+/g, " ")
    .slice(0, 100)
    .trim();
  return cleaned || "document";
}
