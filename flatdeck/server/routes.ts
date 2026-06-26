/**
 * Flatdeck API routes, mounted under /api/flatdeck by the root server.
 *
 * Decks reuse the shared `documents` table (app = 'flatdeck'); a deck's content
 * column holds the presentation JSON ({ version, theme, slides:[{id, markdown}] }).
 * Each slide is markdown with an optional "@layout" directive on its first line.
 * PDF export is client-side (print-to-PDF); the GET export stub is reserved for a
 * future server-rendered (Puppeteer) path.
 */

import "@flatspace/shared/auth";
import type { FastifyPluginAsync } from "fastify";
import { documents } from "@flatspace/shared/db";

const APP = "flatdeck" as const;

export const flatdeckRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authGuard);

  app.get("/decks", async (request) => {
    const user = request.user!;
    const { starred } = request.query as { starred?: string };
    return documents.listForUser(user.id, APP, { starred: starred === "true" });
  });

  app.get("/decks/recent", async (request) => {
    const user = request.user!;
    return documents.recent(user.id, APP);
  });

  app.get("/decks/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const deck = documents.get(Number(id));
    if (!deck || deck.app !== APP || deck.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Deck not found", statusCode: 404 });
    }
    return deck;
  });

  app.post("/decks", async (request, reply) => {
    const user = request.user!;
    const body = (request.body ?? {}) as { title?: string };
    const deck = documents.create({
      title: body.title?.trim() || "Untitled deck",
      ownerId: user.id,
      app: APP,
      folderId: null,
      // A new deck starts with a single title slide.
      content: JSON.stringify({
        version: 1,
        theme: "dark",
        transition: "none",
        slides: [{ id: 1, markdown: "@title\n# New presentation\n\nYour subtitle here" }],
      }),
    });
    return reply.code(201).send(deck);
  });

  app.post("/decks/:id/duplicate", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const deck = documents.get(Number(id));
    if (!deck || deck.app !== APP || deck.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Deck not found", statusCode: 404 });
    }
    const copy = documents.create({
      title: `${deck.title} (copy)`,
      ownerId: user.id,
      app: APP,
      folderId: null,
      content: deck.content,
    });
    return reply.code(201).send(copy);
  });

  app.delete("/decks/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const deck = documents.get(Number(id));
    if (!deck || deck.app !== APP || deck.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Deck not found", statusCode: 404 });
    }
    documents.remove(deck.id);
    return reply.code(204).send();
  });

  app.patch("/decks/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const deck = documents.get(Number(id));
    if (!deck || deck.app !== APP || deck.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Deck not found", statusCode: 404 });
    }
    const body = (request.body ?? {}) as { title?: string; content?: string };
    const updated = documents.update(deck.id, {
      title: body.title?.trim() ? body.title.trim() : undefined,
      content: body.content,
    });
    return updated;
  });

  app.patch("/decks/:id/star", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const deck = documents.get(Number(id));
    if (!deck || deck.app !== APP || deck.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Deck not found", statusCode: 404 });
    }
    documents.setStarred(deck.id, !deck.starred);
    return { id: deck.id, starred: !deck.starred };
  });

  app.get("/decks/:id/export", async (_request, reply) => {
    return reply
      .code(501)
      .send({ error: "NotImplemented", message: "Export arrives with the export milestone.", statusCode: 501 });
  });
};
