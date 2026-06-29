/**
 * ThoughtComposer — the shared editor surface for viewing/editing (screen 2) and
 * composing a new (screen 3) thought. Presentational + controlled: the parent
 * owns title/content and the save status, so the same surface drives both an
 * existing thought (autosave via useThought) and a new one (create-then-patch).
 *
 * The body is a single hybrid "live preview" surface (MarkdownLineEditor): each
 * line renders as markdown except the one being edited, which shows its raw
 * source. The header carries back, the title, save status, and a markdown
 * reference button.
 */

import "./flatthoughts.css";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { MarkdownLineEditor } from "@flatspace/shared/ui";
import type { SaveStatus } from "../hooks/useThought.ts";
import { renderThoughtHtml } from "../lib/thought.ts";
import { MarkdownReference } from "./MarkdownReference.tsx";

export function ThoughtComposer({
  title,
  content,
  status,
  onTitleChange,
  onContentChange,
  onBack,
  backLabel = "Back",
  placeholder = "Jot it down… markdown supported.",
  headerExtra,
  autoFocus = true,
}: {
  title: string;
  content: string;
  status: SaveStatus;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onBack: () => void;
  backLabel?: string;
  placeholder?: string;
  /** Extra header controls (e.g. a tag picker), shown left of the Markdown button. */
  headerExtra?: ReactNode;
  /** Start with the first line in edit mode (true for new notes). */
  autoFocus?: boolean;
}) {
  const [showGuide, setShowGuide] = useState(false);

  // Reflect the thought title in the browser tab.
  useEffect(() => {
    const prev = document.title;
    document.title = `${title.trim() || "New thought"} — Flatspace`;
    return () => {
      document.title = prev;
    };
  }, [title]);

  const statusText =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : "";

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Top chrome */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          onClick={onBack}
          aria-label={backLabel}
          className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-4"
        >
          <ArrowLeft />
        </button>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title (optional)"
          className="min-w-0 flex-1 truncate bg-transparent px-1 text-sm font-medium outline-none placeholder:text-muted-foreground"
        />

        <span className="mr-1 hidden text-xs text-muted-foreground sm:inline">{statusText}</span>

        {headerExtra}

        <button
          onClick={() => setShowGuide(true)}
          aria-label="Markdown reference"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
        >
          <BookOpen /> <span className="hidden sm:inline">Markdown</span>
        </button>
      </header>

      {/* Body: hybrid live-preview editor */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MarkdownLineEditor
          value={content}
          onChange={onContentChange}
          render={renderThoughtHtml}
          placeholder={placeholder}
          proseClassName="ft-prose"
          autoFocus={autoFocus}
          className="mx-auto min-h-full max-w-2xl px-5 py-5"
        />
      </div>

      {showGuide && <MarkdownReference onClose={() => setShowGuide(false)} />}
    </div>
  );
}
