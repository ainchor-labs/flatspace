/**
 * Admin user-management routes, mounted under /api/admin.
 *
 * Lives at the composition root (not in shared/auth) because deleting a user
 * must also remove their Flatdrive blobs from disk — which means composing the
 * shared user model with Flatdrive's storage layer. Every route requires the
 * admin role.
 *
 *   GET    /admin/users        list all users (public shape, no hashes)
 *   POST   /admin/users        create a user { username, password, role }
 *   PATCH  /admin/users/:id     update { role?, password? }
 *   DELETE /admin/users/:id     delete a user + all their data
 */

import "@flatspace/shared/auth"; // FastifyInstance.requireRole / request.user augmentation
import type { FastifyPluginAsync } from "fastify";
import { files, users, toPublicUser } from "@flatspace/shared/db";
import { hashPassword, pickAvatarColor } from "@flatspace/shared/auth";
import { deleteBlob } from "@flatspace/flatdrive/server";
import type { UserRole } from "@flatspace/shared/types";

function badRequest(message: string) {
  return { error: "BadRequest", message, statusCode: 400 } as const;
}

function validUsername(name: unknown): name is string {
  return typeof name === "string" && name.trim().length >= 3 && name.trim().length <= 32;
}

function validRole(role: unknown): role is UserRole {
  return role === "admin" || role === "member";
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Every route here requires an admin.
  app.addHook("preHandler", app.requireRole("admin"));

  app.get("/users", async () => users.list());

  app.post("/users", async (request, reply) => {
    const body = (request.body ?? {}) as { username?: string; password?: string; role?: string };
    const username = body.username?.trim() ?? "";
    if (!validUsername(username)) {
      return reply.code(400).send(badRequest("Username must be 3–32 characters."));
    }
    if (typeof body.password !== "string" || body.password.length < 8) {
      return reply.code(400).send(badRequest("Password must be at least 8 characters."));
    }
    const role: UserRole = validRole(body.role) ? body.role : "member";
    if (users.findByUsername(username)) {
      return reply.code(409).send({ error: "Conflict", message: "That username is already taken.", statusCode: 409 });
    }
    const user = users.create({
      username,
      passwordHash: await hashPassword(body.password),
      role,
      avatarColor: pickAvatarColor(username),
    });
    return reply.code(201).send(toPublicUser(user));
  });

  app.patch("/users/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const target = users.findById(id);
    if (!target) {
      return reply.code(404).send({ error: "NotFound", message: "User not found", statusCode: 404 });
    }
    const body = (request.body ?? {}) as { role?: string; password?: string };

    if (body.role !== undefined) {
      if (!validRole(body.role)) return reply.code(400).send(badRequest("Invalid role."));
      // Never leave the suite without an admin.
      if (target.role === "admin" && body.role !== "admin" && users.countAdmins() <= 1) {
        return reply.code(400).send(badRequest("Can't demote the last remaining admin."));
      }
      users.updateRole(id, body.role);
    }

    if (body.password !== undefined) {
      if (typeof body.password !== "string" || body.password.length < 8) {
        return reply.code(400).send(badRequest("Password must be at least 8 characters."));
      }
      users.updatePassword(id, await hashPassword(body.password));
    }

    const updated = users.findById(id);
    return updated ? toPublicUser(updated) : reply.code(404).send({ error: "NotFound", message: "User not found", statusCode: 404 });
  });

  app.delete("/users/:id", async (request, reply) => {
    const me = request.user!;
    const id = Number((request.params as { id: string }).id);
    const target = users.findById(id);
    if (!target) {
      return reply.code(404).send({ error: "NotFound", message: "User not found", statusCode: 404 });
    }
    if (id === me.id) {
      return reply.code(400).send(badRequest("You can't delete your own account."));
    }
    if (target.role === "admin" && users.countAdmins() <= 1) {
      return reply.code(400).send(badRequest("Can't delete the last remaining admin."));
    }

    // Remove the user's Flatdrive blobs from disk first (the DB rows are cleared
    // by ON DELETE CASCADE when the user row goes), so no orphaned files remain.
    const blobs = files.allForOwner(id);
    await Promise.all(blobs.map((b) => deleteBlob(b.storageKey)));
    users.remove(id);
    return reply.code(204).send();
  });
};
