/**
 * Vite config for the Flatspace web host.
 *
 * - Dev server on :5173, proxying /api → the Fastify server on :3001 so the
 *   httpOnly auth cookie works same-origin.
 * - Imports TypeScript source directly from the workspace packages (shared,
 *   flatfile, flatdeck) — no pre-build step needed in dev.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // expose on the LAN for multi-user testing
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
