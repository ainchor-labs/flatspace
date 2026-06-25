/**
 * Paste capture dialog.
 *
 * The async Clipboard read API is blocked on non-secure (HTTP) origins, so the
 * menu "Paste" can't read the clipboard directly there. This dialog sidesteps
 * that: the user performs a real paste gesture (Ctrl/⌘+V) into a focused capture
 * area, and we read the clipboard payload from the genuine paste event — allowed
 * on HTTP. Rich HTML is preferred (and cleaned by TipTap's schema on insert),
 * falling back to plain text.
 */

import { useEffect, useRef, type ClipboardEvent } from "react";
import type { Editor } from "@tiptap/react";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@flatspace/shared/ui";

export function PasteDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    onClose();
    if (html) editor.chain().focus().insertContent(html).run();
    else if (text) editor.chain().focus().insertContent(text).run();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-2xl animate-scale-in">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium">
          <ClipboardPaste className="size-4 text-primary" /> Paste
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Press <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-xs">Ctrl</kbd>
          {" + "}
          <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-xs">V</kbd> to paste
          into the box below.
        </p>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onPaste={onPaste}
          role="textbox"
          aria-label="Paste target"
          className="min-h-24 w-full rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
          data-placeholder="Paste here…"
        />
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
