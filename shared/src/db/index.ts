/**
 * Public surface of the shared DB package (`@flatspace/shared/db`).
 *
 * Server code imports from here to get the connection, the migration runner, and
 * the typed query helpers. Never imported from the browser bundle.
 */

export { getDb, closeDb, resolveDbPath, type DB } from "./connection.ts";
export { runMigrations, type MigrateResult } from "./migrations/runner.ts";
export { migrations, type Migration } from "./migrations/index.ts";
export {
  users,
  folders,
  documents,
  versions,
  driveFolders,
  files,
  thoughts,
  tags,
  taggings,
  toPublicUser,
  type FileLocation,
} from "./queries.ts";
