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
import { users, toPublicUser } from "../db/queries.ts";
import type { User, UserRole } from "../types/index.ts";
import { verifyToken } from "./jwt.ts";

export const AUTH_COOKIE = "flatspace_token";

declare module "fastify" {
  interface FastifyRequest {
    user: User | null;
  }
  interface FastifyInstance {
    authGuard: preHandlerHookHandler;
    requireRole: (role: UserRole) => preHandlerHookHandler;
  }
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
