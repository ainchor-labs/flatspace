/**
 * MoveToFolderDialog — pick a destination folder for a document (Flatfile folders
 * are a flat list). "No folder" sends the document back to All documents.
 */

import { Check, Files, Folder } from "lucide-react";
import type { Folder as FolderType } from "@flatspace/shared/types";
import { Button } from "@flatspace/shared/ui";
import { cn } from "@flatspace/shared/lib";

export function MoveToFolderDialog({
  docTitle,
  folders,
  currentFolderId,
  onSelect,
  onClose,
}: {
  docTitle: string;
  folders: FolderType[];
  currentFolderId: number | null;
  onSelect: (folderId: number | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-scale-in"
      >
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="truncate text-sm font-semibold">Move “{docTitle}”</h2>
          <p className="text-xs text-muted-foreground">Choose a destination.</p>
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto p-1.5">
          <Row
            icon={<Files />}
            label="All documents (no folder)"
            active={currentFolderId === null}
            onClick={() => onSelect(null)}
          />
          {folders.map((f) => (
            <Row
              key={f.id}
              icon={<Folder />}
              label={f.name}
              active={currentFolderId === f.id}
              onClick={() => onSelect(f.id)}
            />
          ))}
        </div>

        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition hover:bg-accent [&_svg]:size-4 [&_svg]:text-primary/70"
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {active && <Check className={cn("size-4 !text-muted-foreground")} />}
    </button>
  );
}
