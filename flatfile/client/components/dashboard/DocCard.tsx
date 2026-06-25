/**
 * Document card for the Flatfile browser.
 * Shows a markdown-page preview, title, last-edited time, a star toggle, and a
 * right-click / kebab context menu (Rename, Duplicate, Move, Star, Delete, Export).
 */

import { Copy, FileText, FolderInput, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import type { DocumentSummary } from "@flatspace/shared/types";
import { cn } from "@flatspace/shared/lib";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@flatspace/shared/ui";
import { relativeTime } from "../../lib/time.ts";

export function DocCard({
  doc,
  onOpen,
  onToggleStar,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
}: {
  doc: DocumentSummary;
  onOpen: (id: number) => void;
  onToggleStar: (id: number) => void;
  onRename: (doc: DocumentSummary) => void;
  onDuplicate: (doc: DocumentSummary) => void;
  onMove: (doc: DocumentSummary) => void;
  onDelete: (doc: DocumentSummary) => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex h-44 flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition",
        "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
      )}
    >
      <button onClick={() => onOpen(doc.id)} className="flex flex-1 flex-col p-4 text-left">
        {/* faux page preview */}
        <div className="mb-3 flex-1 space-y-1.5 overflow-hidden rounded-md border border-border/60 bg-background/60 p-3">
          <div className="h-2 w-2/3 rounded-full bg-foreground/20" />
          <div className="h-1.5 w-full rounded-full bg-foreground/10" />
          <div className="h-1.5 w-11/12 rounded-full bg-foreground/10" />
          <div className="h-1.5 w-4/5 rounded-full bg-foreground/10" />
        </div>
      </button>

      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <FileText className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{doc.title}</div>
          <div className="text-xs text-muted-foreground">{relativeTime(doc.updatedAt)}</div>
        </div>

        <button
          onClick={() => onToggleStar(doc.id)}
          aria-label={doc.starred ? "Unstar" : "Star"}
          className="rounded p-1 text-muted-foreground transition hover:text-amber-400"
        >
          <Star className={cn("size-4", doc.starred && "fill-amber-400 text-amber-400")} />
        </button>

        <Menu>
          <MenuTrigger>
            <span className="inline-flex rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground">
              <MoreVertical className="size-4" />
            </span>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Pencil />} onSelect={() => onRename(doc)}>
              Rename
            </MenuItem>
            <MenuItem icon={<Copy />} onSelect={() => onDuplicate(doc)}>
              Duplicate
            </MenuItem>
            <MenuItem icon={<FolderInput />} onSelect={() => onMove(doc)}>
              Move to…
            </MenuItem>
            <MenuItem icon={<Star />} onSelect={() => onToggleStar(doc.id)}>
              {doc.starred ? "Unstar" : "Star"}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} destructive onSelect={() => onDelete(doc)}>
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}
