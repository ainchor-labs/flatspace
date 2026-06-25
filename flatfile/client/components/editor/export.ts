/**
 * Client-side export for the Flatfile editor.
 *
 * Three of the four formats are produced entirely in the browser:
 *   - Markdown: the tiptap-markdown extension serializes the live document.
 *   - Plain text: the editor's flattened text content.
 *   - PDF: print-to-PDF via <ExportPreview> (handled in the editor, not here).
 * DOCX is the exception — it needs Pandoc, so we send the rendered markdown to
 * the server and download the bytes it returns.
 */

import type { Editor } from "@tiptap/react";
import { api } from "@flatspace/shared/lib";

/** tiptap-markdown augments editor.storage but isn't in the core types. */
interface MarkdownStorage {
  markdown?: { getMarkdown(): string };
}

/** Serialize the current document to markdown, with the title as an H1. */
function toMarkdown(editor: Editor, title: string): string {
  const storage = editor.storage as MarkdownStorage;
  const body = storage.markdown?.getMarkdown() ?? editor.getText();
  const heading = title.trim() ? `# ${title.trim()}\n\n` : "";
  return heading + body;
}

/** Trigger a browser download for a Blob under the given filename. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Filesystem-safe filename stem derived from the document title. */
function safeFilename(title: string): string {
  const cleaned = title
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 100)
    .trim();
  return cleaned || "document";
}

export function exportMarkdown(editor: Editor, title: string): void {
  const md = toMarkdown(editor, title);
  downloadBlob(new Blob([md], { type: "text/markdown;charset=utf-8" }), `${safeFilename(title)}.md`);
}

export function exportText(editor: Editor, title: string): void {
  const heading = title.trim() ? `${title.trim()}\n\n` : "";
  const txt = heading + editor.getText();
  downloadBlob(new Blob([txt], { type: "text/plain;charset=utf-8" }), `${safeFilename(title)}.txt`);
}

/**
 * Export as DOCX. Sends the rendered markdown to the server (Pandoc) and
 * downloads the result. Throws (via the api client) if Pandoc is unavailable —
 * callers should surface that to the user.
 */
export async function exportDocx(editor: Editor, title: string, docId: number): Promise<void> {
  const markdown = toMarkdown(editor, title);
  const blob = await api.postBlob(`/flatfile/docs/${docId}/export`, { format: "docx", markdown });
  downloadBlob(blob, `${safeFilename(title)}.docx`);
}
