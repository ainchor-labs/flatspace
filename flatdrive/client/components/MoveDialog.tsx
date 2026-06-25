/**
 * MoveDialog — pick a destination folder for files/folders being moved.
 *
 * Navigates the user's own folder tree (via the browse endpoint). Folders that
 * are themselves being moved are not enterable (can't move into self/descendant).
 */

import { useState } from "react";
import { ChevronRight, CornerUpLeft, HardDrive } from "lucide-react";
import { Button } from "@flatspace/shared/ui";
import { useBrowse } from "../hooks/useFlatdrive.ts";

export interface MoveTarget {
  /** Folder ids included in the move — can't be entered or chosen as destination. */
  folderIds: number[];
  /** Where the items currently live; "Move here" is disabled for this location. */
  sourceFolderId: number | null;
  count: number;
}

export function MoveDialog({
  target,
  onMove,
  onClose,
}: {
  target: MoveTarget;
  onMove: (destFolderId: number | null) => void;
  onClose: () => void;
}) {
  const [dest, setDest] = useState<number | null>(null);
  const browse = useBrowse(dest);
  const folders = (browse.data?.folders ?? []).filter((f) => !target.folderIds.includes(f.id));
  const breadcrumb = browse.data?.breadcrumb ?? [];
  const sameAsSource = dest === target.sourceFolderId;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-scale-in"
      >
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">
            Move {target.count} item{target.count === 1 ? "" : "s"}
          </h2>
          <p className="text-xs text-muted-foreground">Choose a destination folder.</p>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 border-b border-border px-4 py-2 text-sm">
          <button
            onClick={() => setDest(null)}
            className="flex items-center gap-1.5 rounded px-1.5 py-1 text-muted-foreground transition hover:text-foreground [&_svg]:size-4"
          >
            <HardDrive /> My Drive
          </button>
          {breadcrumb.map((f) => (
            <span key={f.id} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
              <span className="truncate px-1 py-1 text-foreground">{f.name}</span>
            </span>
          ))}
        </div>

        {/* Subfolders */}
        <div className="min-h-32 flex-1 overflow-y-auto p-1.5">
          {browse.isLoading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : folders.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No subfolders here.</p>
          ) : (
            folders.map((f) => (
              <button
                key={f.id}
                onClick={() => setDest(f.id)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition hover:bg-accent [&_svg]:size-4 [&_svg]:text-primary/70"
              >
                <HardDrive />
                <span className="flex-1 truncate">{f.name}</span>
                <ChevronRight className="size-4 text-muted-foreground/50" />
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          {dest !== null ? (
            <button
              onClick={() => setDest(breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2]!.id : null)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
            >
              <CornerUpLeft /> Up
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={sameAsSource} onClick={() => onMove(dest)}>
              Move here
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
