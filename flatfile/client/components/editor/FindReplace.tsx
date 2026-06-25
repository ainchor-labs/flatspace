/**
 * Find & Replace panel (Ctrl+H) with optional regex + case sensitivity.
 *
 * Matches are collected per text node and mapped to document positions; Next/Prev
 * select + scroll to a match, Replace swaps the current match, Replace All swaps
 * every match (back-to-front so positions stay valid). Replacement is literal
 * (regex applies to matching, not capture-group substitution).
 */

import { useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ArrowDown, ArrowUp, Regex, X } from "lucide-react";
import { cn } from "@flatspace/shared/lib";
import { Button, Input } from "@flatspace/shared/ui";

interface Match {
  from: number;
  to: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectMatches(editor: Editor, query: string, useRegex: boolean, caseSensitive: boolean): Match[] {
  if (!query) return [];
  let re: RegExp;
  try {
    const pattern = useRegex ? query : escapeRegExp(query);
    re = new RegExp(pattern, caseSensitive ? "g" : "gi");
  } catch {
    return [];
  }
  const matches: Match[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text)) !== null) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      matches.push({ from: pos + m.index, to: pos + m.index + m[0].length });
    }
  });
  return matches;
}

export function FindReplace({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [current, setCurrent] = useState(0);

  // Recompute on query change; docDirty is bumped after edits via editor state.
  const matches = useMemo(
    () => collectMatches(editor, find, useRegex, caseSensitive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, find, useRegex, caseSensitive, replace],
  );

  useEffect(() => setCurrent(0), [find, useRegex, caseSensitive]);

  const select = (index: number) => {
    const m = matches[index];
    if (!m) return;
    editor.chain().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
  };

  const go = (delta: number) => {
    if (matches.length === 0) return;
    const next = (current + delta + matches.length) % matches.length;
    setCurrent(next);
    select(next);
  };

  const replaceOne = () => {
    const m = matches[current];
    if (!m) return;
    editor.chain().focus().insertContentAt({ from: m.from, to: m.to }, replace).run();
  };

  const replaceAll = () => {
    if (matches.length === 0) return;
    const chain = editor.chain().focus();
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i]!;
      chain.insertContentAt({ from: m.from, to: m.to }, replace);
    }
    chain.run();
  };

  return (
    <div className="absolute right-4 top-4 z-30 w-80 rounded-lg border border-border bg-popover p-2 shadow-2xl animate-scale-in">
      <div className="mb-2 flex items-center gap-1">
        <div className="relative flex-1">
          <Input
            autoFocus
            value={find}
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                go(e.shiftKey ? -1 : 1);
              }
              if (e.key === "Escape") onClose();
            }}
            placeholder="Find"
            className="pr-16"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground">
            {matches.length ? `${current + 1}/${matches.length}` : "0"}
          </span>
        </div>
        <button
          onClick={() => setUseRegex((v) => !v)}
          aria-label="Use regular expression"
          aria-pressed={useRegex}
          className={cn(
            "flex size-9 items-center justify-center rounded-md border border-border transition [&_svg]:size-4",
            useRegex ? "bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          <Regex />
        </button>
        <button
          onClick={() => setCaseSensitive((v) => !v)}
          aria-label="Match case"
          aria-pressed={caseSensitive}
          className={cn(
            "flex size-9 items-center justify-center rounded-md border border-border text-sm font-semibold transition",
            caseSensitive ? "bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          Aa
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Input
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
          placeholder="Replace"
          className="flex-1"
        />
        <button
          onClick={() => go(-1)}
          aria-label="Previous match"
          className="flex size-9 items-center justify-center rounded-md border border-border transition hover:bg-accent [&_svg]:size-4"
        >
          <ArrowUp />
        </button>
        <button
          onClick={() => go(1)}
          aria-label="Next match"
          className="flex size-9 items-center justify-center rounded-md border border-border transition hover:bg-accent [&_svg]:size-4"
        >
          <ArrowDown />
        </button>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex size-9 items-center justify-center rounded-md border border-border transition hover:bg-accent [&_svg]:size-4"
        >
          <X />
        </button>
      </div>

      <div className="mt-2 flex gap-1.5">
        <Button size="sm" variant="secondary" className="flex-1" onClick={replaceOne}>
          Replace
        </Button>
        <Button size="sm" variant="secondary" className="flex-1" onClick={replaceAll}>
          Replace all
        </Button>
      </div>
    </div>
  );
}
