/**
 * Shared auth routes, mounted by the root server under /api/auth.
 *
 *   GET  /api/auth/setup-status → { needsSetup } — true until the first account exists
 *   POST /api/auth/register  → create the FIRST account only (becomes admin); closed afterward
 *   POST /api/auth/login     → set httpOnly JWT cookie
 *   POST /api/auth/logout    → clear cookie
 *   GET  /api/auth/me        → current user (or 401)
 *
 * Once the first admin exists, public registration is closed — further accounts
 * are created by an admin via the admin user-management routes (server/src/admin-routes).
 *
 * The cookie is httpOnly + sameSite=lax so the SPA can rely on it without ever
 * touching the token in JS (no localStorage — per the suite's rules).
 */

import type { FastifyPluginAsync } from "fastify";
import { users, toPublicUser } from "../db/queries.ts";
import type { AuthResponse, Credentials } from "../types/index.ts";
import { AVATAR_PALETTE, pickAvatarColor } from "./avatar.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { signToken } from "./jwt.ts";
import { AUTH_COOKIE } from "./plugin.ts";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days, matches token TTL
};

function validate(body: unknown): Credentials | null {
  if (typeof body !== "object" || body === null) return null;
  const { username, password } = body as Record<string, unknown>;
  if (typeof username !== "string" || typeof password !== "string") return null;
  const u = username.trim();
  if (u.length < 3 || u.length > 32) return null;
  if (password.length < 8) return null;
  return { username: u, password };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Public: lets the auth screen show a "create admin" form on first run only.
  app.get("/setup-status", async () => ({ needsSetup: users.count() === 0 }));

  app.post("/register", async (request, reply) => {
    // Registration is bootstrap-only: it creates the first (admin) account and is
    // closed thereafter. Admins create further accounts from the admin screen.
    if (users.count() > 0) {
      return reply.code(403).send({
        error: "Forbidden",
        message: "Registration is closed. Ask an administrator to create your account.",
        statusCode: 403,
      });
    }

    const creds = validate(request.body);
    if (!creds) {
      return reply.code(400).send({
        error: "BadRequest",
        message: "Username must be 3–32 chars and password at least 8 chars.",
        statusCode: 400,
      });
    }

    if (users.findByUsername(creds.username)) {
      return reply.code(409).send({
        error: "Conflict",
        message: "That username is already taken.",
        statusCode: 409,
      });
    }

    const passwordHash = await hashPassword(creds.password);
    // Only reachable while there are zero users, so this is always the admin.
    const user = users.create({
      username: creds.username,
      passwordHash,
      role: "admin",
      avatarColor: pickAvatarColor(creds.username),
    });

    const token = signToken({ sub: user.id, username: user.username, role: user.role });
    reply.setCookie(AUTH_COOKIE, token, COOKIE_OPTS);
    const res: AuthResponse = { user: toPublicUser(user) };
    return reply.code(201).send(res);
  });

  app.post("/login", async (request, reply) => {
    const creds = validate(request.body);
    if (!creds) {
      return reply
        .code(400)
        .send({ error: "BadRequest", message: "Invalid credentials.", statusCode: 400 });
    }

    const user = users.findByUsername(creds.username);
    const ok = user && (await verifyPassword(creds.password, user.passwordHash));
    if (!user || !ok) {
      return reply.code(401).send({
        error: "Unauthorized",
        message: "Incorrect username or password.",
        statusCode: 401,
      });
    }

    const token = signToken({ sub: user.id, username: user.username, role: user.role });
    reply.setCookie(AUTH_COOKIE, token, COOKIE_OPTS);
    const res: AuthResponse = { user: toPublicUser(user) };
    return reply.send(res);
  });

  app.post("/logout", async (_request, reply) => {
    reply.clearCookie(AUTH_COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/me", async (request, reply) => {
    if (!request.user) {
      return reply
        .code(401)
        .send({ error: "Unauthorized", message: "Not logged in.", statusCode: 401 });
    }
    const res: AuthResponse = { user: request.user };
    return reply.send(res);
  });

  // Self-service profile updates: change your own avatar color and/or password.
  app.patch("/me", async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Unauthorized", message: "Not logged in.", statusCode: 401 });
    }
    const row = users.findById(request.user.id);
    if (!row) {
      return reply.code(401).send({ error: "Unauthorized", message: "Not logged in.", statusCode: 401 });
    }
    const body = (request.body ?? {}) as {
      avatarColor?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    if (body.avatarColor !== undefined) {
      if (!AVATAR_PALETTE.includes(body.avatarColor as (typeof AVATAR_PALETTE)[number])) {
        return reply.code(400).send({ error: "BadRequest", message: "Unknown avatar color.", statusCode: 400 });
      }
      users.updateAvatarColor(row.id, body.avatarColor);
    }

    if (body.newPassword !== undefined) {
      if (body.newPassword.length < 8) {
        return reply.code(400).send({ error: "BadRequest", message: "New password must be at least 8 characters.", statusCode: 400 });
      }
      const ok = typeof body.currentPassword === "string" && (await verifyPassword(body.currentPassword, row.passwordHash));
      if (!ok) {
        return reply.code(403).send({ error: "Forbidden", message: "Current password is incorrect.", statusCode: 403 });
      }
      users.updatePassword(row.id, await hashPassword(body.newPassword));
    }

    const updated = users.findById(row.id);
    const res: AuthResponse = { user: toPublicUser(updated!) };
    return reply.send(res);
  });
};
