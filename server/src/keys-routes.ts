/**
 * API key management, mounted under /api/keys.
 *
 * These routes are cookie-authenticated (you mint a key from the signed-in web
 * UI), unlike the keys themselves which authenticate the bearer API at /api/v1.
 * The raw secret is returned exactly once, from POST /; afterwards only the
 * non-secret prefix is ever exposed.
 *
 *   GET    /keys          list the user's keys (prefix + metadata, no secret)
 *   POST   /keys          create { name? } → the key, including its secret, once
 *   DELETE /keys/:id      revoke a key
 */

import "@flatspace/shared/auth";
import type { FastifyPluginAsync } from "fastify";
import { apiKeys } from "@flatspace/shared/db";
import { generateApiKey } from "@flatspace/shared/auth";
import type { ApiKeyWithSecret } from "@flatspace/shared/types";

const notFound = { error: "NotFound", message: "Key not found", statusCode: 404 } as const;

export const keysRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authGuard);

  app.get("/keys", async (request) => apiKeys.listForUser(request.user!.id));

  app.post("/keys", async (request, reply) => {
    const user = request.user!;
    const body = (request.body ?? {}) as { name?: string };
    const name = body.name?.trim().slice(0, 60) || "API key";
    const { raw, hash, prefix } = generateApiKey();
    const created = apiKeys.create({ ownerId: user.id, name, keyHash: hash, prefix });
    const response: ApiKeyWithSecret = { ...created, key: raw };
    return reply.code(201).send(response);
  });

  app.delete("/keys/:id", async (request, reply) => {
    const user = request.user!;
    const id = Number((request.params as { id: string }).id);
    const key = apiKeys.get(id);
    if (!key || key.ownerId !== user.id) return reply.code(404).send(notFound);
    apiKeys.remove(key.id);
    return reply.code(204).send();
  });
};
