/**
 * MarkdownLineEditor — a hybrid "live preview" markdown surface.
 *
 * Every line is shown as *rendered* markdown, except the line the caret is on,
 * which drops to its *raw* markdown source for editing (Obsidian/Typora style).
 * Click a line, or arrow into it, to edit it; click/blur away and it re-renders.
 *
 * The full document is a single newline-joined string (`value`); editing is
 * line-granular by design (per the product spec) — multi-line constructs such as
 * fenced code blocks render line-by-line rather than as a single block.
 *
 * Rendering is delegated: the host passes `render(line) => html` so each app can
 * use its own markdown-it instance and prose styles (`proseClassName`).
 */

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { cn } from "../lib/cn.ts";

function autoGrow(ta: HTMLTextAreaElement) {
  ta.style.height = "auto";
  ta.style.height = `${ta.scrollHeight}px`;
}

export function MarkdownLineEditor({
  value,
  onChange,
  render,
  placeholder,
  proseClassName,
  className,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Render a single raw markdown line to an HTML string. */
  render: (line: string) => string;
  placeholder?: string;
  /** Typography class applied to each rendered line (e.g. "ft-prose"). */
  proseClassName?: string;
  /** Wrapper class — the host controls height/scroll/padding. */
  className?: string;
  autoFocus?: boolean;
}) {
  // The document as lines. An empty document is still one (empty) line so there
  // is always somewhere to click.
  const lines = value.length ? value.split("\n") : [""];
  const [active, setActive] = useState<number | null>(autoFocus ? 0 : null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  // Caret column to apply once the active line's textarea mounts/focuses.
  const caretRef = useRef<number | null>(null);

  // Focus the active line and place the caret after structural edits.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (active === null || !ta) return;
    if (document.activeElement !== ta) ta.focus();
    if (caretRef.current != null) {
      const p = Math.max(0, Math.min(caretRef.current, ta.value.length));
      ta.setSelectionRange(p, p);
      caretRef.current = null;
    }
    autoGrow(ta);
  }, [active, value]);

  const commit = (next: string[]) => onChange(next.join("\n"));

  const editLine = (i: number, caret: number) => {
    caretRef.current = caret;
    setActive(i);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (active === null) return;
    const ta = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = ta;
    const i = active;
    const line = lines[i] ?? "";

    if (e.key === "Enter") {
      e.preventDefault();
      const next = [...lines];
      next.splice(i, 1, line.slice(0, start), line.slice(end));
      caretRef.current = 0;
      setActive(i + 1);
      commit(next);
    } else if (e.key === "Backspace" && start === 0 && end === 0 && i > 0) {
      e.preventDefault();
      const prev = lines[i - 1] ?? "";
      const next = [...lines];
      next.splice(i - 1, 2, prev + line);
      caretRef.current = prev.length;
      setActive(i - 1);
      commit(next);
    } else if (e.key === "Delete" && start === line.length && end === line.length && i < lines.length - 1) {
      e.preventDefault();
      const next = [...lines];
      next.splice(i, 2, line + (lines[i + 1] ?? ""));
      caretRef.current = line.length; // active stays i; effect re-runs on value change
      commit(next);
    } else if ((e.key === "ArrowUp" || e.key === "ArrowLeft") && start === 0 && i > 0) {
      e.preventDefault();
      editLine(i - 1, (lines[i - 1] ?? "").length);
    } else if ((e.key === "ArrowDown" || e.key === "ArrowRight") && start === line.length && i < lines.length - 1) {
      e.preventDefault();
      editLine(i + 1, 0);
    } else if (e.key === "Escape") {
      e.preventDefault();
      ta.blur();
      setActive(null);
    }
  };

  const activateRendered = (e: ReactMouseEvent, i: number) => {
    // Keep focus from flickering off the current textarea before we move it.
    e.preventDefault();
    editLine(i, (lines[i] ?? "").length);
  };

  return (
    <div className={cn("relative", className)}>
      {lines.map((line, i) =>
        i === active ? (
          <textarea
            key={i}
            ref={taRef}
            value={line}
            rows={1}
            spellCheck
            onChange={(e) => {
              const next = [...lines];
              next[i] = e.target.value;
              commit(next);
              autoGrow(e.currentTarget);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setActive((a) => (a === i ? null : a))}
            className="block w-full resize-none overflow-hidden bg-transparent font-mono text-sm leading-relaxed text-foreground outline-none"
          />
        ) : (
          <div
            key={i}
            onMouseDown={(e) => activateRendered(e, i)}
            className={cn(
              "cursor-text [&_blockquote]:my-0 [&_h1]:my-0 [&_h2]:my-0 [&_h3]:my-0 [&_h4]:my-0 [&_ol]:my-0 [&_p]:my-0 [&_pre]:my-0 [&_ul]:my-0",
              proseClassName,
            )}
          >
            {i === 0 && value.length === 0 && placeholder ? (
              <span className="block font-mono leading-relaxed text-muted-foreground/60">{placeholder}</span>
            ) : line.trim() === "" ? (
              <span className="block leading-relaxed">{" "}</span>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: render(line) }} />
            )}
          </div>
        ),
      )}
    </div>
  );
}
