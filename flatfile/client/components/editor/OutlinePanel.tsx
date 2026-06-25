/**
 * Document outline — auto-generated from headings, collapsible left panel.
 * Clicking an entry moves the caret to that heading and scrolls it into view.
 */

import type { Editor } from "@tiptap/react";
import { cn } from "@flatspace/shared/lib";

interface Heading {
  level: number;
  text: string;
  pos: number;
}

function collectHeadings(editor: Editor): Heading[] {
  const headings: Heading[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({
        level: (node.attrs.level as number) ?? 1,
        text: node.textContent || "Untitled",
        pos,
      });
    }
  });
  return headings;
}

export function OutlinePanel({ editor }: { editor: Editor }) {
  const headings = collectHeadings(editor);

  const goTo = (pos: number) => {
    editor.chain().focus().setTextSelection(pos + 1).run();
    const dom = editor.view.domAtPos(pos + 1).node as Node | undefined;
    const el = (dom instanceof HTMLElement ? dom : dom?.parentElement) ?? null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Outline
      </div>
      {headings.length === 0 ? (
        <p className="px-4 text-xs text-muted-foreground">
          Headings you add will appear here.
        </p>
      ) : (
        <nav className="space-y-0.5 overflow-y-auto px-2 pb-4">
          {headings.map((h, i) => (
            <button
              key={`${h.pos}-${i}`}
              onClick={() => goTo(h.pos)}
              className={cn(
                "block w-full truncate rounded-md py-1 pr-2 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground",
              )}
              style={{ paddingLeft: `${0.5 + (h.level - 1) * 0.75}rem` }}
              title={h.text}
            >
              {h.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
