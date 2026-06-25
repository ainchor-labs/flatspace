/**
 * Standalone migration CLI: `pnpm migrate`.
 * Applies any pending migrations to the shared SQLite database, then exits.
 */

import { getDb, resolveDbPath, runMigrations } from "@flatspace/shared/db";

function main(): void {
  console.log(`[migrate] database: ${resolveDbPath()}`);
  const db = getDb();
  const { applied, alreadyCurrent } = runMigrations(db);
  if (alreadyCurrent) {
    console.log("[migrate] already up to date.");
  } else {
    for (const m of applied) console.log(`[migrate] applied #${m.id} ${m.name}`);
    console.log(`[migrate] done — ${applied.length} migration(s) applied.`);
  }
}

main();
