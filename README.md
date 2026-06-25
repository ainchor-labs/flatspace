# Flatspace Suite

A sleek, self-hosted productivity suite — **Flatfile** (docs) + **Flatdeck** (slides) —
built for a home server with local-network multi-user collaboration. Dark-first,
indigo-accented, no cloud, no CDN.

## Stack

- **Frontend:** React + TypeScript, Tailwind, shadcn-style components, Vite
- **Backend:** Node + Fastify, one server, routes namespaced per app
- **DB:** SQLite (better-sqlite3), shared across apps
- **Auth:** local username/password, JWT in httpOnly cookies
- **Realtime (later):** Yjs + Socket.io
- **Monorepo:** pnpm workspaces

## Layout

```
shared/    design tokens · UI shell · auth · db · sockets · api client
server/    root Fastify server (mounts auth + per-app routes, runs migrations)
flatfile/  server routes + client dashboard (markdown doc editor)
flatdeck/  server routes + client dashboard (slide editor)
web/       Vite SPA host — shared shell + app dashboards + routing
```

## Getting started

```bash
pnpm install          # install everything
pnpm migrate          # create the SQLite schema
pnpm dev              # Fastify (:7532) + Vite (:5173) together
```

Open http://localhost:5173 and register — **the first account becomes admin**.

```bash
pnpm --filter @flatspace/server seed   # optional: sample docs/folders for the first user
```

### Production-ish

```bash
pnpm build            # build the web SPA → web/dist
pnpm dev:server       # Fastify serves web/dist + the API on :7532
```

## Environment

| Variable                | Default                | Purpose                          |
| ----------------------- | ---------------------- | -------------------------------- |
| `PORT`                  | `7532`                 | Fastify port                     |
| `HOST`                  | `0.0.0.0`              | Bind address (LAN multi-user)    |
| `FLATSPACE_DB_PATH`     | `./data/flatspace.sqlite` | SQLite file location          |
| `FLATSPACE_JWT_SECRET`  | dev fallback (warns)   | **Set this before LAN exposure** |

## Export prerequisites

- **Pandoc** — Flatfile PDF/DOCX export (detected on startup)
- **Puppeteer** — Flatdeck PDF export (detected on startup)

Missing tools only disable their export path; the suite still runs.

## Status

Built: monorepo, DB + migrations, auth, shared shell + app switcher, Flatfile
file browser, Flatdeck browser, and the **Flatfile document editor** (TipTap +
markdown, bubble toolbar, slash commands, outline, find & replace with regex,
callouts/tables/task-lists/code blocks, autosave, word-count status bar).

Next milestones: Flatdeck slide canvas, version history, realtime sync (Yjs +
Socket.io), and exports (Pandoc / Puppeteer).
