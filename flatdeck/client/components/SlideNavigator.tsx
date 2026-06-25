/**
 * SlideNavigator — the left rail of slide thumbnails.
 *
 * Each slide renders as a live (scaled) SlideView so the rail always reflects the
 * real deck. Selection drives the editor; a per-slide menu handles move/duplicate/
 * delete, and an Add button appends a new slide.
 */

import { MoreVertical, Plus } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@flatspace/shared/ui";
import { cn } from "@flatspace/shared/lib";
import type { DeckTheme, Slide } from "../lib/deck.ts";
import { SlideView } from "./SlideView.tsx";

export function SlideNavigator({
  slides,
  theme,
  current,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: {
  slides: Slide[];
  theme: DeckTheme;
  current: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {slides.map((slide, i) => (
          <div key={slide.id} className="group relative flex items-start gap-1.5">
            <span className="w-4 shrink-0 pt-1 text-right text-xs text-muted-foreground">{i + 1}</span>
            <button
              onClick={() => onSelect(i)}
              className={cn(
                "relative block w-full overflow-hidden rounded-md border-2 transition",
                i === current ? "border-primary" : "border-border hover:border-primary/40",
              )}
            >
              <SlideView slide={slide} theme={theme} />
            </button>
            <Menu className="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100">
              <MenuTrigger>
                <span className="flex size-6 items-center justify-center rounded bg-background/80 text-muted-foreground hover:text-foreground [&_svg]:size-3.5">
                  <MoreVertical />
                </span>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem onSelect={() => onMove(i, -1)}>Move up</MenuItem>
                <MenuItem onSelect={() => onMove(i, 1)}>Move down</MenuItem>
                <MenuItem onSelect={() => onDuplicate(i)}>Duplicate</MenuItem>
                <MenuItem destructive onSelect={() => onDelete(i)}>
                  Delete
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-border p-2">
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground [&_svg]:size-3.5"
        >
          <Plus /> Add slide
        </button>
      </div>
    </div>
  );
}
