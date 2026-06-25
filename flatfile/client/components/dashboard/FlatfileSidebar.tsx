/**
 * Flatfile sidebar — the file-browser navigation that fills the shared Sidebar.
 * New-document button, primary views (Recent / All / Starred), and the folder
 * tree. Folder drag-and-drop reorganisation lands with the folders milestone.
 */

import { Clock, FilePlus2, Files, Folder, FolderPlus, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import type { Folder as FolderType } from "@flatspace/shared/types";
import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from "@flatspace/shared/ui";
import { cn } from "@flatspace/shared/lib";
import { SidebarItem, SidebarSection } from "@flatspace/shared/ui";

export type FlatfileView = "recent" | "all" | "starred" | { folderId: number };

export function FlatfileSidebar({
  view,
  onSelect,
  folders,
  onNewDocument,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  view: FlatfileView;
  onSelect: (view: FlatfileView) => void;
  folders: FolderType[];
  onNewDocument: () => void;
  onNewFolder: () => void;
  onRenameFolder: (folder: FolderType) => void;
  onDeleteFolder: (folder: FolderType) => void;
}) {
  const isFolder = typeof view === "object";
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button className="w-full justify-start" onClick={onNewDocument}>
          <FilePlus2 /> New document
        </Button>
      </div>

      <SidebarSection>
        <SidebarItem
          icon={<Clock />}
          label="Recent"
          active={view === "recent"}
          onClick={() => onSelect("recent")}
        />
        <SidebarItem
          icon={<Files />}
          label="All documents"
          active={view === "all"}
          onClick={() => onSelect("all")}
        />
        <SidebarItem
          icon={<Star />}
          label="Starred"
          active={view === "starred"}
          onClick={() => onSelect("starred")}
        />
      </SidebarSection>

      <SidebarSection title="Folders">
        {folders.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">No folders yet</p>
        ) : (
          folders.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              active={isFolder && view.folderId === f.id}
              onSelect={() => onSelect({ folderId: f.id })}
              onRename={() => onRenameFolder(f)}
              onDelete={() => onDeleteFolder(f)}
            />
          ))
        )}
      </SidebarSection>

      <div className="mt-auto p-3">
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={onNewFolder}>
          <FolderPlus /> New folder
        </Button>
      </div>
    </div>
  );
}

function FolderRow({
  folder,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  folder: FolderType;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition [&_svg]:size-4",
        active
          ? "bg-accent font-medium text-foreground [&_svg]:text-primary"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <Folder />
        <span className="truncate">{folder.name}</span>
      </button>
      <Menu className="opacity-0 transition group-hover:opacity-100">
        <MenuTrigger>
          <span className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground [&_svg]:size-3.5">
            <MoreVertical />
          </span>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem icon={<Pencil />} onSelect={onRename}>
            Rename
          </MenuItem>
          <MenuItem icon={<Trash2 />} destructive onSelect={onDelete}>
            Delete
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
