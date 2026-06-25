/**
 * Startup environment checks.
 *
 * Pandoc (Flatfile PDF/DOCX export) and Puppeteer/Chromium (Flatdeck PDF export)
 * are optional at boot but required for export. Per the suite rules we detect
 * them on startup and print clear warnings rather than crashing.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

async function hasPandoc(): Promise<string | null> {
  try {
    const { stdout } = await exec("pandoc", ["--version"]);
    return stdout.split("\n")[0]?.trim() ?? "pandoc";
  } catch {
    return null;
  }
}

async function hasPuppeteer(): Promise<boolean> {
  try {
    // Optional dependency — resolved via a non-literal specifier so the build
    // doesn't require it to be installed.
    const mod = "puppeteer";
    await import(mod);
    return true;
  } catch {
    return false;
  }
}

export async function runStartupChecks(log: {
  info: (m: string) => void;
  warn: (m: string) => void;
}): Promise<void> {
  const pandoc = await hasPandoc();
  if (pandoc) log.info(`✓ Pandoc detected (${pandoc}) — Flatfile PDF/DOCX export enabled`);
  else
    log.warn(
      "⚠ Pandoc not found — Flatfile PDF/DOCX export will be unavailable. Install pandoc to enable it.",
    );

  const puppeteer = await hasPuppeteer();
  if (puppeteer) log.info("✓ Puppeteer available — Flatdeck PDF export enabled");
  else
    log.warn(
      "⚠ Puppeteer not installed — Flatdeck PDF export will be unavailable. Run `pnpm add puppeteer` in /flatdeck to enable it.",
    );
}
