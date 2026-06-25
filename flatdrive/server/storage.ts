/**
 * Flatdrive blob storage + Office conversion.
 *
 * Uploaded bytes live on disk under the uploads dir (mirrors resolveDbPath's
 * cwd/data convention; override with FLATSPACE_UPLOADS_PATH), keyed by an opaque
 * random storage key. We stream uploads straight to disk (no buffering) with a
 * size cap, so large media never sits in memory. DOCX preview shells out to the
 * already-present Pandoc.
 */

import { createWriteStream, mkdirSync, statSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";
import { Transform, type Readable } from "node:stream";

const execFileAsync = promisify(execFile);

/** Default 1 GiB upload cap; override with FLATSPACE_MAX_UPLOAD (bytes). */
export const MAX_UPLOAD_BYTES = Number(process.env.FLATSPACE_MAX_UPLOAD ?? 1024 * 1024 * 1024);

export function resolveUploadsDir(): string {
  const fromEnv = process.env.FLATSPACE_UPLOADS_PATH;
  return fromEnv ? resolve(fromEnv) : resolve(process.cwd(), "data", "uploads");
}

export function filePath(storageKey: string): string {
  return join(resolveUploadsDir(), storageKey);
}

export class FileTooLargeError extends Error {
  constructor() {
    super("File exceeds the maximum upload size");
    this.name = "FileTooLargeError";
  }
}

export class PandocMissingError extends Error {
  constructor() {
    super("Pandoc is not installed — DOCX preview is unavailable.");
    this.name = "PandocMissingError";
  }
}

/** Stream an upload to disk under a fresh storage key; returns key + byte size. */
export async function saveStream(source: Readable): Promise<{ storageKey: string; size: number }> {
  const dir = resolveUploadsDir();
  mkdirSync(dir, { recursive: true });
  const storageKey = randomUUID();
  const dest = join(dir, storageKey);

  let size = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) cb(new FileTooLargeError());
      else cb(null, chunk);
    },
  });

  try {
    await pipeline(source, meter, createWriteStream(dest));
  } catch (err) {
    await unlink(dest).catch(() => {});
    throw err;
  }
  return { storageKey, size };
}

export async function deleteBlob(storageKey: string): Promise<void> {
  await unlink(filePath(storageKey)).catch(() => {});
}

/** Total byte size of a stored blob, or null if it's missing on disk. */
export function blobSize(storageKey: string): number | null {
  try {
    return statSync(filePath(storageKey)).size;
  } catch {
    return null;
  }
}

/** Convert a stored .docx to a self-contained HTML document (images embedded). */
export async function docxToHtml(storageKey: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "pandoc",
      ["-f", "docx", "-t", "html", "--standalone", "--embed-resources", filePath(storageKey)],
      { maxBuffer: 128 * 1024 * 1024 },
    );
    return stdout;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new PandocMissingError();
    throw err;
  }
}
