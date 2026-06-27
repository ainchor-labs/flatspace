/**
 * Flatspace root server.
 *
 * One Fastify instance for the whole suite. Responsibilities:
 *   1. Run DB migrations on boot.
 *   2. Register the shared auth plugin (cookie + request.user).
 *   3. Mount route trees namespaced per app:
 *        /api/auth          (shared)
 *        /api/flatfile/...  (Flatfile)
 *        /api/flatdeck/...  (Flatdeck)
 *   4. Attach the realtime (Yjs/Socket.io) layer.
 *   5. In production, serve the built web SPA; in dev the Vite server proxies here.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { authPlugin, authRoutes } from "@flatspace/shared/auth";
import { getDb, resolveDbPath, runMigrations } from "@flatspace/shared/db";
import { attachRealtime } from "@flatspace/shared/sockets";
import { flatfileRoutes } from "@flatspace/flatfile/server";
import { flatdeckRoutes } from "@flatspace/flatdeck/server";
import { flatdriveRoutes } from "@flatspace/flatdrive/server";
import { flatthoughtsRoutes } from "@flatspace/flatthoughts/server";
import { adminRoutes } from "./admin-routes.ts";
import { tagsRoutes } from "./tags-routes.ts";
import { keysRoutes } from "./keys-routes.ts";
import { apiV1Routes } from "./api/v1-routes.ts";
import { runStartupChecks } from "./startup-checks.ts";

const PORT = Number(process.env.PORT ?? 7532);
const HOST = process.env.HOST ?? "0.0.0.0"; // bind to LAN for multi-user access
const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      transport: { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
    },
  });

  // 1. Migrations
  app.log.info(`database: ${resolveDbPath()}`);
  const { applied } = runMigrations(getDb());
  if (applied.length) app.log.info(`applied ${applied.length} migration(s)`);

  // 2. Auth (cookie + request.user decoration + guards)
  await app.register(authPlugin);

  // Raw-binary body passthrough: Flatdrive uploads send the file as the request
  // body with a binary content-type. JSON/text keep their built-in parsers; this
  // catch-all hands everything else to the handler as an unbuffered stream (so
  // large files never sit in memory and the default body limit doesn't apply).
  app.addContentTypeParser("*", (_request, payload, done) => done(null, payload));

  // Health check
  app.get("/api/health", async () => ({ ok: true, name: "flatspace", version: "0.1.0" }));

  // 3. Route trees, namespaced per app
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(adminRoutes, { prefix: "/api/admin" });
  await app.register(tagsRoutes, { prefix: "/api/tags" });
  await app.register(keysRoutes, { prefix: "/api" });
  await app.register(flatfileRoutes, { prefix: "/api/flatfile" });
  await app.register(flatdeckRoutes, { prefix: "/api/flatdeck" });
  await app.register(flatdriveRoutes, { prefix: "/api/flatdrive" });
  await app.register(flatthoughtsRoutes, { prefix: "/api/flatthoughts" });

  // Programmatic REST API (API-key auth via Authorization: Bearer <key>).
  await app.register(apiV1Routes, { prefix: "/api/v1" });

  // 5. Serve the built SPA in production (dev uses Vite + proxy)
  const webDist = resolve(__dirname, "../../web/dist");
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist });
    // SPA fallback for client-side routes
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api")) {
        return reply.code(404).send({ error: "NotFound", message: "Unknown API route", statusCode: 404 });
      }
      return reply.sendFile("index.html");
    });
  }

  await runStartupChecks(app.log);

  await app.listen({ port: PORT, host: HOST });

  // 4. Realtime (no-op until the realtime milestone)
  attachRealtime(app.server);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
