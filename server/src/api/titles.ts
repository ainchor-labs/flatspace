/**
 * Title derivation for the programmatic API.
 *
 * Each app stores content in its own shape, but the rule the user wants is the
 * same idea everywhere: the title is the first meaningful line of the content.
 *   - FlatThoughts: markdown  → first non-empty line
 *   - FlatFiles:    TipTap HTML → text of the first block
 *   - FlatDecks:    deck JSON → first line of the title (first) slide
 *
 * These mirror the client display helpers (e.g. thoughtTitle) but stay
 * dependency-free so they're safe to run server-side.
 */

/** First meaningful line of markdown, with heading/list markers stripped. */
export function markdownTitle(content: string): string {
  const line = content
    .split("\n")
    .map((l) => l.replace(/^#{1,6}\s*/, "").replace(/^[-*+]\s+/, "").trim())
    .find(Boolean);
  return line ?? "";
}

/** First non-empty line of TipTap/HTML content, as plain text. */
export function htmlTitle(html: string): string {
  const text = html
    // Turn block boundaries into line breaks so "first line" is meaningful.
    .replace(/<(?:br|\/p|\/h[1-6]|\/li|\/div|\/blockquote)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "") // strip remaining tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  return line ?? "";
}

/** The title-screen text of a deck: first line of the first slide's markdown. */
export function deckTitle(content: string): string {
  try {
    const obj = JSON.parse(content) as { slides?: { markdown?: string }[] };
    const first = obj.slides?.[0]?.markdown ?? "";
    // Drop a leading layout directive line (@title / @section / @center / @default).
    const lines = first.split("\n");
    let i = 0;
    while (i < lines.length && (lines[i] ?? "").trim() === "") i++;
    if (/^@[a-zA-Z][a-zA-Z-]*\s*$/.test(lines[i] ?? "")) i++;
    return markdownTitle(lines.slice(i).join("\n"));
  } catch {
    return "";
  }
}
