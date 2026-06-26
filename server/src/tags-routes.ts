/**
 * Tag routes, mounted under /api/tags.
 *
 * A shared, per-user tag vocabulary plus assignment to any taggable entity
 * (Flatfile doc / Flatdeck deck = "document", Flatdrive file = "file",
 * Flatthoughts note = "thought"). Every route is auth-guarded and owner-scoped.
 *
 *   GET    /tags                list the user's tags (with usage counts)
 *   POST   /tags                create { name, color }
 *   PATCH  /tags/:id            update { name?, color? }
 *   DELETE /tags/:id            delete a tag (and all its assignments)
 *   PUT    /tags/entity         set an entity's full tag set { entityType, entityId, tagIds }
 */

import "@flatspace/shared/auth";
import type { FastifyPluginAsync } from "fastify";
import { tags, taggings } from "@flatspace/shared/db";
import { TAG_PALETTE, type TagEntityType } from "@flatspace/shared/types";

const ENTITY_TYPES = new Set<TagEntityType>(["document", "file", "thought"]);
const HEX = /^#[0-9a-fA-F]{6}$/;

function badRequest(message: string) {
  return { error: "BadRequest", message, statusCode: 400 } as const;
}

function notFound(message: string) {
  return { error: "NotFound", message, statusCode: 404 } as const;
}

function normalizeColor(color: unknown): string {
  return typeof color === "string" && HEX.test(color) ? color : TAG_PALETTE[0];
}

export const tagsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authGuard);

  app.get("/", async (request) => tags.listForUser(request.user!.id));

  app.post("/", async (request, reply) => {
    const user = request.user!;
    const body = (request.body ?? {}) as { name?: string; color?: string };
    const name = body.name?.trim() ?? "";
    if (name.length < 1 || name.length > 40) {
      return reply.code(400).send(badRequest("Tag name must be 1–40 characters."));
    }
    const tag = tags.create({ ownerId: user.id, name, color: normalizeColor(body.color) });
    return reply.code(201).send(tag);
  });

  app.patch("/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const tag = tags.get(Number(id));
    if (!tag || tag.ownerId !== user.id) return reply.code(404).send(notFound("Tag not found"));

    const body = (request.body ?? {}) as { name?: string; color?: string };
    const fields: { name?: string; color?: string } = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (name.length < 1 || name.length > 40) {
        return reply.code(400).send(badRequest("Tag name must be 1–40 characters."));
      }
      fields.name = name;
    }
    if (body.color !== undefined) fields.color = normalizeColor(body.color);
    return tags.update(tag.id, fields);
  });

  app.delete("/:id", async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const tag = tags.get(Number(id));
    if (!tag || tag.ownerId !== user.id) return reply.code(404).send(notFound("Tag not found"));
    tags.remove(tag.id);
    return reply.code(204).send();
  });

  // Replace an entity's full tag set. Verifies the caller owns the entity; only
  // the caller's own tags get attached (foreign/unknown ids are dropped).
  app.put("/entity", async (request, reply) => {
    const user = request.user!;
    const body = (request.body ?? {}) as {
      entityType?: string;
      entityId?: number;
      tagIds?: unknown;
    };
    const entityType = body.entityType as TagEntityType;
    if (!ENTITY_TYPES.has(entityType) || !Number.isInteger(body.entityId)) {
      return reply.code(400).send(badRequest("entityType and entityId are required."));
    }
    const ownerId = taggings.entityOwnerId(entityType, body.entityId!);
    if (ownerId === null) return reply.code(404).send(notFound("Item not found"));
    if (ownerId !== user.id) return reply.code(404).send(notFound("Item not found"));

    const tagIds = Array.isArray(body.tagIds)
      ? body.tagIds.filter((n): n is number => Number.isInteger(n))
      : [];
    return taggings.setForEntity(entityType, body.entityId!, user.id, tagIds);
  });
};
