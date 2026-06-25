/**
 * Slash-command menu popup.
 *
 * Rendered by the SlashCommand extension (via @tiptap/suggestion + ReactRenderer)
 * when the user types "/". Keyboard-navigable; the parent extension forwards
 * key events through the imperative `onKeyDown` handle.
 */

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@flatspace/shared/lib";
import type { SlashItem } from "./extensions/slash-items.ts";

export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface Props {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

export const SlashCommandMenu = forwardRef<SlashMenuRef, Props>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSelected(0), [items]);

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selected];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-lg border border-border bg-popover p-3 text-sm text-muted-foreground shadow-2xl">
        No matching blocks
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-2xl animate-scale-in"
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            data-index={i}
            onMouseEnter={() => setSelected(i)}
            onClick={() => command(item)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition",
              i === selected ? "bg-accent" : "hover:bg-accent/60",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{item.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
});
SlashCommandMenu.displayName = "SlashCommandMenu";
