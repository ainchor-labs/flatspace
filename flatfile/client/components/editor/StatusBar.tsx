/**
 * Editor status bar — word count + reading time, plus the save indicator.
 */

import type { Editor } from "@tiptap/react";
import { Check, CircleAlert, Loader2 } from "lucide-react";
import type { SaveStatus } from "../../hooks/useDocument.ts";

const WPM = 200;

function stats(editor: Editor): { words: number; minutes: number } {
  const text = editor.state.doc.textContent.trim();
  const words = text ? text.split(/\s+/).length : 0;
  return { words, minutes: Math.max(1, Math.ceil(words / WPM)) };
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    );
  if (status === "saved")
    return (
      <span className="flex items-center gap-1.5 text-emerald-400">
        <Check className="size-3.5" /> Saved
      </span>
    );
  if (status === "error")
    return (
      <span className="flex items-center gap-1.5 text-destructive">
        <CircleAlert className="size-3.5" /> Save failed
      </span>
    );
  return null;
}

export function StatusBar({ editor, status }: { editor: Editor; status: SaveStatus }) {
  const { words, minutes } = stats(editor);
  return (
    <div className="flex h-8 shrink-0 items-center gap-4 border-t border-border bg-card/40 px-4 text-xs text-muted-foreground">
      <span>{words.toLocaleString()} words</span>
      <span>{minutes} min read</span>
      <div className="ml-auto">
        <SaveIndicator status={status} />
      </div>
    </div>
  );
}
