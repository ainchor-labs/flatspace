/**
 * Flatdrive API routes, mounted under /api/flatdrive by the root server.
 *
 *   GET    /browse?folderId=          folder listing: breadcrumb + subfolders + files
 *   POST   /folders                   create a folder { name, parentId }
 *   PATCH  /folders/:id               rename a folder { name }
 *   DELETE /folders/:id               delete a folder (recursive: removes blobs + rows)
 *   POST   /files?folderId=&name=     upload (raw request body is the file bytes)
 *   GET    /files/:id                 file metadata
 *   GET    /files/:id/raw?download=   stream the bytes (supports Range for video/audio)
 *   GET    /files/:id/preview-docx    Pandoc-rendered HTML for .docx preview
 *   PATCH  /files/:id                 rename / move { name?, folderId? }
 *   DELETE /files/:id                 delete a file (blob + row)
 *   GET    /search?q=                 search files by name
 *
 * Every route requires auth and is scoped to the current user. Uploads arrive as
 * a raw binary body (the root server registers a catch-all content-type parser),
 * with filename + target folder passed as query params.
 */

import "@flatspace/shared/auth";
import type { FastifyPluginAsync } from "fastify";
import { createReadStream, statSync } from "node:fs";
import type { Readable } from "node:stream";
import { driveFolders, files } from "@flatspace/shared/db";
import {
  deleteBlob,
  docxToHtml,
  filePath,
  FileTooLargeError,
  PandocMissingError,
  saveStream,
} from "./storage.ts";

const notFound = { error: "NotFound", message: "Not found", statusCode: 404 };

function parseFolderId(raw: string | undefined): number | null {
  return raw == null || raw === "" || raw === "null" ? null : Number(raw);
}

function safeName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "").replace(/\s+/g, " ").trim() || "file";
}

function isDocx(mime: string, name: string): boolean {
  return (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.toLowerCase().endsWith(".docx")
  );
}

export const flatdriveRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authGuard);

  // ---- Browsing ----------------------------------------------------------
  app.get("/browse", async (request, reply) => {
    const user = request.user!;
    const fid = parseFolderId((request.query as { folderId?: string }).folderId);
    if (fid !== null) {
      const folder = driveFolders.get(fid);
      if (!folder || folder.ownerId !== user.id) return reply.code(404).send(notFound);
      return {
        folder,
        breadcrumb: driveFolders.breadcrumb(fid, user.id),
        folders: driveFolders.listChildren(user.id, fid),
        files: files.listInFolder(user.id, fid),
      };
    }
    return {
      folder: null,
      breadcrumb: [],
      folders: driveFolders.listChildren(user.id, null),
      files: files.listInFolder(user.id, null),
    };
  });

  // Flat, cross-folder views (Recent / All / Starred) for the sidebar.
  app.get("/recent", async (request) => {
    const user = request.user!;
    return files.recent(user.id);
  });

  app.get("/all", async (request) => {
    const user = request.user!;
    const { starred } = request.query as { starred?: string };
    return files.listAll(user.id, { starred: starred === "true" });
  });

  app.get("/search", async (request) => {
    const user = request.user!;
    const { q } = request.query as { q?: string };
    if (!q?.trim()) return [];
    return files.search(user.id, q.trim());
  });

  // ---- Folders -----------------------------------------------------------
  app.post("/folders", async (request, reply) => {
    const user = request.user!;
    const body = (request.body ?? {}) as { name?: string; parentId?: number | null };
    if (!body.name?.trim()) {
      return reply.code(400).send({ error: "BadRequest", message: "Folder name required", statusCode: 400 });
    }
    const parentId = body.parentId ?? null;
    if (parentId !== null) {
      const parent = driveFolders.get(parentId);
      if (!parent || parent.ownerId !== user.id) return reply.code(404).send(notFound);
    }
    return reply.code(201).send(driveFolders.create({ name: body.name.trim(), ownerId: user.id, parentId }));
  });

  app.patch("/folders/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const folder = driveFolders.get(id);
    if (!folder || folder.ownerId !== user.id) return reply.code(404).send(notFound);
    const body = (request.body ?? {}) as { name?: string; parentId?: number | null };

    if (body.parentId !== undefined) {
      const parentId = parseFolderId(body.parentId == null ? undefined : String(body.parentId));
      if (parentId !== null) {
        const dest = driveFolders.get(parentId);
        if (!dest || dest.ownerId !== user.id) return reply.code(404).send(notFound);
        // Refuse to move a folder into itself or one of its own descendants.
        if (driveFolders.isInSubtree(parentId, id)) {
          return reply
            .code(400)
            .send({ error: "BadRequest", message: "Can't move a folder into itself.", statusCode: 400 });
        }
      }
      driveFolders.move(id, parentId);
    }

    if (body.name?.trim()) driveFolders.rename(id, body.name.trim());
    return driveFolders.get(id);
  });

  app.delete("/folders/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const folder = driveFolders.get(id);
    if (!folder || folder.ownerId !== user.id) return reply.code(404).send(notFound);
    // Remove blobs for every file in the subtree, then drop the folder
    // (ON DELETE CASCADE clears subfolders + file rows).
    const blobs = files.allUnderFolder(user.id, id);
    await Promise.all(blobs.map((b) => deleteBlob(b.storageKey)));
    driveFolders.remove(id);
    return reply.code(204).send();
  });

  // ---- Files -------------------------------------------------------------
  app.post("/files", async (request, reply) => {
    const user = request.user!;
    const query = request.query as { folderId?: string; name?: string; mime?: string };
    const folderId = parseFolderId(query.folderId);
    if (folderId !== null) {
      const folder = driveFolders.get(folderId);
      if (!folder || folder.ownerId !== user.id) return reply.code(404).send(notFound);
    }

    const body = request.body as Readable | undefined;
    if (!body || typeof body.pipe !== "function") {
      return reply
        .code(400)
        .send({ error: "BadRequest", message: "Expected a file body", statusCode: 400 });
    }

    const name = safeName(query.name?.trim() || "upload");
    // The real mime rides in a query param (the body is transported as
    // octet-stream so no built-in parser consumes it); fall back to the header.
    const mime = (query.mime || request.headers["content-type"] || "application/octet-stream")
      .split(";")[0]!
      .trim();

    try {
      const { storageKey, size } = await saveStream(body);
      const item = files.create({ name, ownerId: user.id, folderId, mime, size, storageKey });
      return reply.code(201).send(item);
    } catch (err) {
      if (err instanceof FileTooLargeError) {
        return reply.code(413).send({ error: "TooLarge", message: err.message, statusCode: 413 });
      }
      throw err;
    }
  });

  app.get("/files/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const file = files.get(id);
    if (!file || file.ownerId !== user.id) return reply.code(404).send(notFound);
    return file;
  });

  app.get("/files/:id/raw", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const loc = files.location(id);
    if (!loc || loc.ownerId !== user.id) return reply.code(404).send(notFound);

    const path = filePath(loc.storageKey);
    let total: number;
    try {
      total = statSync(path).size;
    } catch {
      return reply.code(404).send(notFound);
    }

    const download = (request.query as { download?: string }).download != null;
    reply.header("Accept-Ranges", "bytes");
    reply.header("Content-Type", loc.mime);
    reply.header(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${safeName(loc.name)}"`,
    );

    const range = request.headers.range;
    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (match) {
      let start = match[1] ? parseInt(match[1], 10) : 0;
      let end = match[2] ? parseInt(match[2], 10) : total - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= total) end = total - 1;
      if (start > end || start >= total) {
        return reply.code(416).header("Content-Range", `bytes */${total}`).send();
      }
      return reply
        .code(206)
        .header("Content-Range", `bytes ${start}-${end}/${total}`)
        .header("Content-Length", end - start + 1)
        .send(createReadStream(path, { start, end }));
    }

    return reply.header("Content-Length", total).send(createReadStream(path));
  });

  app.get("/files/:id/preview-docx", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const loc = files.location(id);
    if (!loc || loc.ownerId !== user.id) return reply.code(404).send(notFound);
    if (!isDocx(loc.mime, loc.name)) {
      return reply.code(400).send({ error: "BadRequest", message: "Not a .docx file", statusCode: 400 });
    }
    try {
      return { html: await docxToHtml(loc.storageKey) };
    } catch (err) {
      if (err instanceof PandocMissingError) {
        return reply.code(501).send({ error: "NotImplemented", message: err.message, statusCode: 501 });
      }
      request.log.error(err, "docx preview failed");
      return reply.code(500).send({ error: "PreviewFailed", message: "Couldn’t render document", statusCode: 500 });
    }
  });

  app.patch("/files/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const file = files.get(id);
    if (!file || file.ownerId !== user.id) return reply.code(404).send(notFound);

    const body = (request.body ?? {}) as { name?: string; folderId?: number | null };
    if (body.name?.trim()) files.rename(id, safeName(body.name.trim()));
    if (Object.prototype.hasOwnProperty.call(body, "folderId")) {
      const target = body.folderId ?? null;
      if (target !== null) {
        const folder = driveFolders.get(target);
        if (!folder || folder.ownerId !== user.id) return reply.code(404).send(notFound);
      }
      files.move(id, target);
    }
    return files.get(id);
  });

  app.patch("/files/:id/star", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const file = files.get(id);
    if (!file || file.ownerId !== user.id) return reply.code(404).send(notFound);
    files.setStarred(id, !file.starred);
    return { id, starred: !file.starred };
  });

  app.delete("/files/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const loc = files.location(id);
    if (!loc || loc.ownerId !== user.id) return reply.code(404).send(notFound);
    await deleteBlob(loc.storageKey);
    files.remove(id);
    return reply.code(204).send();
  });
};
