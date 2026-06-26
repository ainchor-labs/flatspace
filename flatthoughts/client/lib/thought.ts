/**
 * Thought helpers: markdown rendering + display derivations.
 *
 * A thought's content is plain markdown (rendered with markdown-it, matching
 * Flatdeck's renderer settings). The title is optional — when blank we derive a
 * display title from the first meaningful line of the content.
 */

import MarkdownIt from "markdown-it";
import type { Thought } from "@flatspace/shared/types";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true });

/** Render a thought's markdown body to HTML. */
export function renderThoughtHtml(content: string): string {
  return md.render(content || "");
}

/** A display title: the explicit title, else the first non-empty content line. */
export function thoughtTitle(thought: Pick<Thought, "title" | "content">): string {
  if (thought.title.trim()) return thought.title.trim();
  const firstLine = thought.content
    .split("\n")
    .map((l) => l.replace(/^#{1,6}\s*/, "").replace(/^[-*+]\s+/, "").trim())
    .find(Boolean);
  return firstLine || "Untitled thought";
}

/** A plain-text snippet of the body for cards (markdown punctuation stripped). */
export function thoughtSnippet(thought: Pick<Thought, "title" | "content">, max = 180): string {
  // When the title is derived from the first content line, skip that line so the
  // snippet adds information rather than repeating the heading.
  const lines = thought.content.split("\n");
  const raw = thought.title.trim() ? thought.content : lines.slice(1).join("\n");
  const text = raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** Short relative-ish date used on cards. */
export function shortDate(iso: string): string {
  // SQLite returns "YYYY-MM-DD HH:MM:SS" in UTC; normalise to an ISO instant.
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
