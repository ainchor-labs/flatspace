/**
 * Server-side document export helpers.
 *
 * Markdown/plain-text/PDF export all happen client-side (the editor already owns
 * a faithful markdown serialization, and PDF is print-to-PDF). DOCX is the one
 * format that needs an external tool: we shell out to Pandoc, feeding the
 * client-rendered markdown on stdin and reading the .docx back from stdout.
 *
 * Pandoc is optional at boot (see server/src/startup-checks.ts). If it isn't
 * installed the spawn fails with ENOENT, which callers translate into a clear
 * 501 rather than a 500.
 */

import { spawn } from "node:child_process";

/** Raised when pandoc is not installed/!on PATH so routes can map it to a 501. */
export class PandocMissingError extends Error {
  constructor() {
    super("Pandoc is not installed — DOCX export is unavailable.");
    this.name = "PandocMissingError";
  }
}

/**
 * Convert markdown to a DOCX document via Pandoc, returning the raw bytes.
 * Streams through stdin/stdout so no temp files are left on disk.
 */
export function markdownToDocx(markdown: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // `-o -` writes the (binary) docx to stdout.
    const pandoc = spawn("pandoc", ["--from=markdown", "--to=docx", "-o", "-"]);

    const out: Buffer[] = [];
    const err: Buffer[] = [];

    pandoc.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    pandoc.stderr.on("data", (chunk: Buffer) => err.push(chunk));

    pandoc.on("error", (e: NodeJS.ErrnoException) => {
      reject(e.code === "ENOENT" ? new PandocMissingError() : e);
    });

    pandoc.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`pandoc exited with code ${code}: ${Buffer.concat(err).toString().trim()}`));
    });

    pandoc.stdin.on("error", () => {
      /* swallow EPIPE if pandoc dies before we finish writing; 'error'/'close' handle it */
    });
    pandoc.stdin.write(markdown);
    pandoc.stdin.end();
  });
}
