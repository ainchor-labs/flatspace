/**
 * Fastify auth plugin (shared across Flatfile + Flatdeck routes).
 *
 * - Registers @fastify/cookie so the JWT cookie can be read/written.
 * - Decorates every request with `request.user` (the authenticated User or null),
 *   resolved from the httpOnly cookie on each request.
 * - Exposes `app.authGuard` (require any logged-in user) and `app.requireRole`
 *   (require a specific role) as preHandlers for protected routes.
 */

import cookie from "@fastify/cookie";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import fp from "fastify-plugin";
import { users, apiKeys, toPublicUser } from "../db/queries.ts";
import type { User, UserRole } from "../types/index.ts";
import { verifyToken } from "./jwt.ts";
import { hashApiKey } from "./apikey.ts";

export const AUTH_COOKIE = "flatspace_token";

declare module "fastify" {
  interface FastifyRequest {
    user: User | null;
  }
  interface FastifyInstance {
    authGuard: preHandlerHookHandler;
    apiKeyGuard: preHandlerHookHandler;
    requireRole: (role: UserRole) => preHandlerHookHandler;
  }
}

/** Pull the bearer token out of an Authorization header, or null. */
function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim() || null;
}

function unauthorized(reply: FastifyReply): void {
  reply.code(401).send({
    error: "Unauthorized",
    message: "Authentication required.",
    statusCode: 401,
  });
}

const plugin: FastifyPluginAsync = async (app) => {
  await app.register(cookie);

  app.decorateRequest("user", null);

  // Resolve the current user from the cookie on every request.
  app.addHook("onRequest", async (request: FastifyRequest) => {
    const token = request.cookies[AUTH_COOKIE];
    if (!token) return;
    const payload = verifyToken(token);
    if (!payload) return;
    const row = users.findById(payload.sub);
    request.user = row ? toPublicUser(row) : null;
  });

  app.decorate("authGuard", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) unauthorized(reply);
  });

  // Bearer-token guard for the programmatic API (/api/v1). Independent of the
  // cookie: it resolves the user strictly from the Authorization header's API
  // key, so scripts authenticate the same way regardless of any browser session.
  app.decorate("apiKeyGuard", async (request: FastifyRequest, reply: FastifyReply) => {
    const token = bearerToken(request);
    if (!token) return unauthorized(reply);
    const hash = hashApiKey(token);
    const ownerId = apiKeys.ownerByHash(hash);
    if (ownerId === null) return unauthorized(reply);
    const row = users.findById(ownerId);
    if (!row) return unauthorized(reply);
    request.user = toPublicUser(row);
    apiKeys.touchByHash(hash);
  });

  app.decorate("requireRole", (role: UserRole): preHandlerHookHandler => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) return unauthorized(reply);
      if (request.user.role !== role && request.user.role !== "admin") {
        reply.code(403).send({
          error: "Forbidden",
          message: `Requires ${role} role.`,
          statusCode: 403,
        });
      }
    };
  });
};

export const authPlugin = fp(plugin, { name: "flatspace-auth" });
