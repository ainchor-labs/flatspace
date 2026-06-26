/**
 * ThoughtComposer — the shared editor surface for viewing/editing (screen 2) and
 * composing a new (screen 3) thought. Presentational + controlled: the parent
 * owns title/content and the save status, so the same surface drives both an
 * existing thought (autosave via useThought) and a new one (create-then-patch).
 *
 * Left: a markdown textarea. Right: a live rendered preview. The header carries
 * back, the title, save status, and a markdown reference button.
 */

import "./flatthoughts.css";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, Eye, Pencil } from "lucide-react";
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
}) {
  const [showGuide, setShowGuide] = useState(false);
  // On narrow screens the split won't fit — toggle between write & preview.
  const [mobileView, setMobileView] = useState<"write" | "preview">("write");
  const html = useMemo(() => renderThoughtHtml(content), [content]);

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

        {/* Mobile write/preview toggle */}
        <button
          onClick={() => setMobileView((v) => (v === "write" ? "preview" : "write"))}
          aria-label={mobileView === "write" ? "Show preview" : "Show editor"}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden [&_svg]:size-3.5"
        >
          {mobileView === "write" ? <Eye /> : <Pencil />}
          {mobileView === "write" ? "Preview" : "Write"}
        </button>

        {headerExtra}

        <button
          onClick={() => setShowGuide(true)}
          aria-label="Markdown reference"
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
        >
          <BookOpen /> <span className="hidden sm:inline">Markdown</span>
        </button>
      </header>

      {/* Body: split editor | preview */}
      <div className="flex min-h-0 flex-1">
        <div
          className={`min-w-0 flex-1 border-r border-border md:flex md:w-1/2 ${
            mobileView === "write" ? "flex" : "hidden"
          }`}
        >
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            autoFocus
            spellCheck
            placeholder={placeholder}
            className="min-h-0 w-full flex-1 resize-none bg-transparent p-5 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div
          className={`min-w-0 flex-1 overflow-y-auto bg-muted/15 md:block md:w-1/2 ${
            mobileView === "preview" ? "block" : "hidden md:block"
          }`}
        >
          {content.trim() ? (
            <div className="ft-prose mx-auto max-w-2xl p-6" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground/60">
              Preview appears here as you type.
            </div>
          )}
        </div>
      </div>

      {showGuide && <MarkdownReference onClose={() => setShowGuide(false)} />}
    </div>
  );
}
