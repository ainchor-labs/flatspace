/**
 * From-scratch clipboard write that works over plain HTTP.
 *
 * The async Clipboard API (navigator.clipboard.writeText / readText) is only
 * available in secure contexts (HTTPS or localhost), so it can't be relied on
 * for a LAN HTTP deployment. Instead we serialize the editor's current selection
 * to HTML + plain text with ProseMirror's DOMSerializer and push it onto the
 * clipboard by synthesizing a native `copy` event — supported everywhere, no
 * secure context needed.
 */

import { DOMSerializer } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";

export interface ClipboardPayload {
  html: string;
  text: string;
}

/** Serialize the current (non-empty) selection to clipboard-ready html + text. */
export function getSelectionClipboard(editor: Editor): ClipboardPayload | null {
  const { state } = editor.view;
  const sel = state.selection;
  if (sel.empty) return null;

  const serializer = DOMSerializer.fromSchema(state.schema);
  const fragment = serializer.serializeFragment(sel.content().content);
  const container = document.createElement("div");
  container.appendChild(fragment);

  return {
    html: container.innerHTML,
    text: state.doc.textBetween(sel.from, sel.to, "\n\n", "\n"),
  };
}

/**
 * Write html + text to the clipboard without the async API. Selects a throwaway
 * element so execCommand('copy') reliably fires, overrides the payload via the
 * copy event, then restores the user's prior DOM selection.
 */
export function writeClipboard(payload: ClipboardPayload): boolean {
  const onCopy = (e: ClipboardEvent) => {
    e.clipboardData?.setData("text/html", payload.html);
    e.clipboardData?.setData("text/plain", payload.text);
    e.preventDefault();
  };

  const dummy = document.createElement("div");
  dummy.contentEditable = "true";
  dummy.textContent = payload.text || " ";
  Object.assign(dummy.style, {
    position: "fixed",
    top: "0",
    left: "0",
    opacity: "0",
    pointerEvents: "none",
    whiteSpace: "pre",
  });
  document.body.appendChild(dummy);

  const selection = window.getSelection();
  const saved: Range[] = [];
  if (selection) {
    for (let i = 0; i < selection.rangeCount; i++) saved.push(selection.getRangeAt(i).cloneRange());
  }

  const range = document.createRange();
  range.selectNodeContents(dummy);
  selection?.removeAllRanges();
  selection?.addRange(range);

  document.addEventListener("copy", onCopy);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.removeEventListener("copy", onCopy);

  selection?.removeAllRanges();
  saved.forEach((r) => selection?.addRange(r));
  dummy.remove();
  return ok;
}

export function copySelection(editor: Editor): boolean {
  const payload = getSelectionClipboard(editor);
  if (!payload) return false;
  return writeClipboard(payload);
}

export function cutSelection(editor: Editor): boolean {
  const payload = getSelectionClipboard(editor);
  if (!payload) return false;
  const ok = writeClipboard(payload);
  if (ok) editor.chain().focus().deleteSelection().run();
  return ok;
}
