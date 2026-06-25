/**
 * Dev seed: `pnpm --filter @flatspace/server seed`.
 *
 * Populates the first registered user's account with sample folders + Flatfile
 * documents and a Flatdeck deck so the dashboards look alive during development.
 * Idempotent-ish: skips if the user already has documents. Register an account
 * first, then run this.
 */

import { getDb, runMigrations, documents, folders } from "@flatspace/shared/db";

interface UserIdRow {
  id: number;
}

const SAMPLE_FOLDERS = ["Projects", "Notes", "Drafts"];

const SAMPLE_DOCS: { title: string; content: string }[] = [
  { title: "Welcome to Flatspace", content: "# Welcome\n\nThis is your first document." },
  { title: "Q3 Roadmap", content: "# Roadmap\n\n- [ ] Ship editor\n- [ ] Realtime sync" },
  { title: "Meeting notes — Kickoff", content: "## Kickoff\n\nAttendees: ..." },
  { title: "Design system tokens", content: "Indigo accent, near-black surfaces." },
  { title: "API reference (draft)", content: "## Endpoints\n\n`GET /api/flatfile/docs`" },
  { title: "Reading list", content: "1. Yjs CRDTs\n2. TipTap internals" },
];

function main(): void {
  const db = getDb();
  runMigrations(db);

  const user = db.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get() as
    | UserIdRow
    | undefined;
  if (!user) {
    console.error("[seed] No users found — register an account first, then re-run seed.");
    process.exit(1);
  }

  const existing = documents.listForUser(user.id, "flatfile", {});
  if (existing.length > 0) {
    console.log("[seed] User already has documents — nothing to do.");
    return;
  }

  const created = folders.create({ name: SAMPLE_FOLDERS[0]!, ownerId: user.id, app: "flatfile", parentId: null });
  for (const name of SAMPLE_FOLDERS.slice(1)) {
    folders.create({ name, ownerId: user.id, app: "flatfile", parentId: null });
  }

  SAMPLE_DOCS.forEach((doc, i) => {
    documents.create({
      title: doc.title,
      content: doc.content,
      ownerId: user.id,
      app: "flatfile",
      folderId: i < 2 ? created.id : null,
    });
  });
  // Star a couple for the Starred view.
  const docs = documents.listForUser(user.id, "flatfile", {});
  documents.setStarred(docs[0]!.id, true);
  documents.setStarred(docs[1]!.id, true);

  documents.create({
    title: "Product launch deck",
    ownerId: user.id,
    app: "flatdeck",
    folderId: null,
    content: JSON.stringify({ theme: "dark", slides: [{ id: 1, elements: [] }] }),
  });

  console.log(`[seed] Seeded ${SAMPLE_DOCS.length} docs + 1 deck for user #${user.id}.`);
}

main();
