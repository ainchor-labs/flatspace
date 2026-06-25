/**
 * MarkdownGuide — a cheat-sheet modal for the markdown shortcuts the editor
 * supports (StarterKit input rules + task lists, highlight, links, images), plus
 * a few keyboard shortcuts. Opened from the editor chrome; closes on backdrop
 * click or Escape.
 */

import { useEffect } from "react";
import { X } from "lucide-react";

interface Row {
  syntax: string;
  label: string;
}

interface Section {
  title: string;
  rows: Row[];
}

const SECTIONS: Section[] = [
  {
    title: "Text",
    rows: [
      { syntax: "**bold**", label: "Bold" },
      { syntax: "*italic*", label: "Italic" },
      { syntax: "~~strikethrough~~", label: "Strikethrough" },
      { syntax: "`inline code`", label: "Inline code" },
      { syntax: "==highlight==", label: "Highlight" },
    ],
  },
  {
    title: "Headings",
    rows: [
      { syntax: "# Heading 1", label: "Large heading" },
      { syntax: "## Heading 2", label: "Section heading" },
      { syntax: "### Heading 3", label: "Sub-heading" },
      { syntax: "#### Heading 4", label: "Small heading" },
    ],
  },
  {
    title: "Lists",
    rows: [
      { syntax: "- item", label: "Bullet list" },
      { syntax: "1. item", label: "Numbered list" },
      { syntax: "[ ] task", label: "Checklist" },
    ],
  },
  {
    title: "Blocks",
    rows: [
      { syntax: "> quote", label: "Blockquote" },
      { syntax: "```", label: "Code block" },
      { syntax: "---", label: "Divider" },
    ],
  },
  {
    title: "Links & media",
    rows: [
      { syntax: "[text](url)", label: "Link" },
      { syntax: "![alt](url)", label: "Image" },
    ],
  },
];

const SHORTCUTS: Row[] = [
  { syntax: "⌘ / Ctrl + B", label: "Bold" },
  { syntax: "⌘ / Ctrl + I", label: "Italic" },
  { syntax: "⌘ / Ctrl + U", label: "Underline" },
  { syntax: "⌘ / Ctrl + F", label: "Find & replace" },
  { syntax: "/", label: "Open the command menu" },
];

export function MarkdownGuide({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/50 p-4 pt-[8vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-scale-in"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold">Markdown reference</h2>
            <p className="text-xs text-muted-foreground">
              Type these as you write — they transform automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-4"
          >
            <X />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <Group key={section.title} title={section.title} rows={section.rows} />
            ))}
            <Group title="Keyboard shortcuts" rows={SHORTCUTS} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.syntax + r.label} className="flex items-center justify-between gap-3">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              {r.syntax}
            </code>
            <span className="text-xs text-muted-foreground">{r.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
