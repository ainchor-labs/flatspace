/**
 * Flatthoughts API routes, mounted under /api/flatthoughts by the root server.
 *
 * Thoughts are quick markdown notes kept in their own `thoughts` table (one row
 * per note). Every route is auth-guarded and owner-scoped. Beyond plain CRUD,
 * triage ("Tinder") mode uses GET /thoughts/review for the deck order and
 * POST /thoughts/:id/review to mark a kept thought as reviewed.
 */

import "@flatspace/shared/auth";
import type { FastifyPluginAsync } from "fastify";
import { thoughts } from "@flatspace/shared/db";

export const flatthoughtsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authGuard);

  app.get("/thoughts", async (request) => {
    const user = request.user!;
    return thoughts.listForUser(user.id);
  });

  // Triage deck order: least-recently-reviewed first.
  app.get("/thoughts/review", async (request) => {
    const user = request.user!;
    return thoughts.forReview(user.id);
  });

  app.get("/thoughts/search", async (request) => {
    const user = request.user!;
    const term = ((request.query as { q?: string }).q ?? "").trim();
    if (!term) return [];
    return thoughts.search(user.id, term);
  });

  app.get("/thoughts/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const thought = thoughts.get(Number(id));
    if (!thought || thought.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Thought not found", statusCode: 404 });
    }
    return thought;
  });

  app.post("/thoughts", async (request, reply) => {
    const user = request.user!;
    const body = (request.body ?? {}) as { title?: string; content?: string };
    const thought = thoughts.create({
      ownerId: user.id,
      title: body.title?.trim() || "",
      content: typeof body.content === "string" ? body.content : "",
    });
    return reply.code(201).send(thought);
  });

  app.patch("/thoughts/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const thought = thoughts.get(Number(id));
    if (!thought || thought.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Thought not found", statusCode: 404 });
    }
    const body = (request.body ?? {}) as { title?: string; content?: string };
    return thoughts.update(thought.id, {
      title: body.title !== undefined ? body.title : undefined,
      content: body.content !== undefined ? body.content : undefined,
    });
  });

  // Keep (right swipe): stamp reviewed_at so it sinks in the triage order.
  app.post("/thoughts/:id/review", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const thought = thoughts.get(Number(id));
    if (!thought || thought.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Thought not found", statusCode: 404 });
    }
    return thoughts.markReviewed(thought.id);
  });

  // Toss (left swipe) / delete.
  app.delete("/thoughts/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const thought = thoughts.get(Number(id));
    if (!thought || thought.ownerId !== user.id) {
      return reply.code(404).send({ error: "NotFound", message: "Thought not found", statusCode: 404 });
    }
    thoughts.remove(thought.id);
    return reply.code(204).send();
  });
};
