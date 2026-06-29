/**
 * Markdown rendering for the optional "markdown mode" editor.
 *
 * The rich editor is TipTap; markdown mode (MarkdownLineEditor) renders each
 * line on its own with this markdown-it instance, scoped to `.ff-prose`.
 */

import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true });

/** Render a single raw markdown line to an HTML string. */
export function renderDocMarkdown(line: string): string {
  return md.render(line || "");
}
