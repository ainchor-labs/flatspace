/**
 * Flatdrive dashboard — the file browser.
 *
 * Breadcrumb folder navigation, a "New" menu (upload file/folder, new Flatfile/
 * Flatdeck), New folder, and a grid/list of subfolders + files. Supports sorting,
 * a grid/list view toggle, multi-select with bulk move/delete, per-item move/
 * rename/delete, and drag-and-drop upload. Images show a live thumbnail.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  FileUp,
  FolderInput,
  FolderPlus,
  FolderUp,
  HardDrive,
  LayoutGrid,
  Lightbulb,
  List as ListIcon,
  MoreVertical,
  Plus,
  Presentation,
  Star,
  Tag as TagIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { DriveAppItem, DriveFolder, FileItem, Tag } from "@flatspace/shared/types";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  TagChips,
  TagFilterBar,
  TagPicker,
  useDialog,
  useToast,
} from "@flatspace/shared/ui";
import { ApiRequestError, cn, useTags } from "@flatspace/shared/lib";
import {
  fileRawUrl,
  useBrowse,
  useCreateFolder,
  useDeleteFile,
  useDeleteFolder,
  useMoveFile,
  useMoveFolder,
  useRecentFiles,
  useRenameFile,
  useRenameFolder,
  useStarredFiles,
  useToggleStarFile,
  useUploadFile,
} from "../hooks/useFlatdrive.ts";
import { formatBytes, iconFor, previewKind } from "../lib/fileType.ts";
import { MoveDialog, type MoveTarget } from "./MoveDialog.tsx";

type SortKey = "name" | "modified" | "size";
type View = "grid" | "list";

/** Flat cross-folder views (no folder browsing). */
export type FlatView = "recent" | "starred";

const FLAT_TITLES: Record<FlatView, string> = { recent: "Recent", starred: "Starred" };

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  modified: "Last modified",
  size: "Size",
};

/** SQLite datetime('now') is UTC without a zone — append Z then localise. */
function formatDate(iso: string): string {
  const d = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function sortFolders(folders: DriveFolder[], key: SortKey): DriveFolder[] {
  const copy = [...folders];
  if (key === "modified") copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else copy.sort((a, b) => a.name.localeCompare(b.name)); // folders have no size
  return copy;
}

function sortFiles(files: FileItem[], key: SortKey): FileItem[] {
  const copy = [...files];
  if (key === "modified") copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  else if (key === "size") copy.sort((a, b) => b.size - a.size);
  else copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy;
}

/** Icon + type label for a cross-app item. */
function appItemMeta(kind: DriveAppItem["kind"]) {
  if (kind === "flatdeck") return { Icon: Presentation, label: "Deck" };
  if (kind === "flatthought") return { Icon: Lightbulb, label: "Note" };
  return { Icon: FileText, label: "Document" };
}

/** Grid card for a doc/deck/note. Open-only — managed in its own app. */
function AppItemCard({ item, onOpen }: { item: DriveAppItem; onOpen: () => void }) {
  const { Icon, label } = appItemMeta(item.kind);
  return (
    <button
      onClick={onOpen}
      title={`Open in ${label === "Document" ? "Flatfile" : label === "Deck" ? "Flatdeck" : "Flatthoughts"}`}
      className="group relative flex h-36 flex-col rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex flex-1 items-center justify-center [&_svg]:size-10 [&_svg]:text-primary/70">
        <Icon />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{item.name || "Untitled"}</div>
        <div className="text-xs text-muted-foreground">
          {label} · {formatDate(item.updatedAt)}
        </div>
        {item.tags.length > 0 && <TagChips tags={item.tags} max={2} className="mt-1 flex-nowrap" />}
      </div>
    </button>
  );
}

/** List row for a doc/deck/note. */
function AppItemRow({ item, onOpen, first }: { item: DriveAppItem; onOpen: () => void; first: boolean }) {
  const { Icon, label } = appItemMeta(item.kind);
  return (
    <button
      onClick={onOpen}
      className={cn(
        "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-accent [&_svg]:size-4",
        !first && "border-t border-border",
      )}
    >
      <Icon className="shrink-0 text-primary/70" />
      <span className="min-w-0 flex-1 truncate text-sm">{item.name || "Untitled"}</span>
      {item.tags.length > 0 && <TagChips tags={item.tags} max={2} className="hidden shrink-0 sm:flex" />}
      <span className="shrink-0 text-xs text-muted-foreground">
        {label} · {formatDate(item.updatedAt)}
      </span>
    </button>
  );
}

export function FlatdriveDashboard({
  folderId,
  flatView = null,
  onOpenFolder,
  onOpenFile,
  onOpenAppItem,
  registerUpload,
  onNewFlatfile,
  onNewFlatdeck,
  onNewFlatthought,
}: {
  folderId: number | null;
  /** When set, show a flat cross-folder file list instead of the folder browser. */
  flatView?: FlatView | null;
  onOpenFolder: (id: number | null) => void;
  onOpenFile: (id: number) => void;
  /** Open a cross-app item (doc/deck/note) in its originating app. */
  onOpenAppItem?: (item: DriveAppItem) => void;
  /** Lets a parent (e.g. the sidebar's Upload button) open the file picker. */
  registerUpload?: (open: () => void) => void;
  /** Create a new Flatfile document (wired by the web host) and open it. */
  onNewFlatfile?: () => void;
  /** Create a new Flatdeck presentation (wired by the web host) and open it. */
  onNewFlatdeck?: () => void;
  /** Start a new Flatthoughts note (wired by the web host). */
  onNewFlatthought?: () => void;
}) {
  const browse = useBrowse(folderId);
  const recent = useRecentFiles(flatView === "recent");
  const starred = useStarredFiles(flatView === "starred");
  const upload = useUploadFile();
  const createFolder = useCreateFolder();
  const renameFile = useRenameFile();
  const deleteFile = useDeleteFile();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const moveFile = useMoveFile();
  const moveFolder = useMoveFolder();
  const toggleStar = useToggleStarFile();
  const allTags = useTags();
  const { toast } = useToast();
  const { confirm, prompt } = useDialog();
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<View>("grid");
  const [tagFilter, setTagFilter] = useState<Set<number>>(new Set());
  const toggleTagFilter = (id: number) =>
    setTagFilter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Multi-select (cleared whenever the folder changes).
  const [selFolders, setSelFolders] = useState<Set<number>>(new Set());
  const [selFiles, setSelFiles] = useState<Set<number>>(new Set());
  const [moving, setMoving] = useState<{ fileIds: number[]; folderIds: number[] } | null>(null);

  useEffect(() => {
    setSelFolders(new Set());
    setSelFiles(new Set());
  }, [folderId, flatView]);

  useEffect(() => {
    registerUpload?.(() => fileRef.current?.click());
  }, [registerUpload]);

  // `webkitdirectory` isn't in the standard input typings — set it imperatively.
  useEffect(() => {
    folderRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const errMsg = (err: unknown, fallback: string) =>
    err instanceof ApiRequestError ? err.message : fallback;

  const uploadFiles = useCallback(
    async (list: FileList | File[]) => {
      for (const file of Array.from(list)) await upload.mutateAsync({ file, folderId });
    },
    [upload, folderId],
  );

  // Upload a picked directory, recreating its subfolder structure.
  const uploadFolder = useCallback(
    async (list: FileList) => {
      const dirIds = new Map<string, number | null>([["", folderId]]);
      const ensureDir = async (path: string): Promise<number | null> => {
        if (dirIds.has(path)) return dirIds.get(path) ?? null;
        const slash = path.lastIndexOf("/");
        const parentPath = slash === -1 ? "" : path.slice(0, slash);
        const name = slash === -1 ? path : path.slice(slash + 1);
        const parentId = await ensureDir(parentPath);
        const created = await createFolder.mutateAsync({ name, parentId });
        dirIds.set(path, created.id);
        return created.id;
      };
      for (const file of Array.from(list)) {
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const slash = rel.lastIndexOf("/");
        const dir = slash === -1 ? "" : rel.slice(0, slash);
        await upload.mutateAsync({ file, folderId: await ensureDir(dir) });
      }
    },
    [upload, createFolder, folderId],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
  };

  const newFolder = async () => {
    const name = await prompt({ title: "New folder", placeholder: "Folder name", confirmText: "Create" });
    if (name?.trim()) {
      try {
        await createFolder.mutateAsync({ name: name.trim(), parentId: folderId });
      } catch (err) {
        toast({ message: errMsg(err, "Couldn’t create the folder."), variant: "error" });
      }
    }
  };

  const renameFolderItem = async (folder: DriveFolder) => {
    const name = await prompt({ title: "Rename folder", defaultValue: folder.name, confirmText: "Rename" });
    if (name?.trim() && name.trim() !== folder.name) {
      try {
        await renameFolder.mutateAsync({ id: folder.id, name: name.trim() });
      } catch (err) {
        toast({ message: errMsg(err, "Couldn’t rename the folder."), variant: "error" });
      }
    }
  };

  const renameFileItem = async (file: FileItem) => {
    const name = await prompt({ title: "Rename file", defaultValue: file.name, confirmText: "Rename" });
    if (name?.trim() && name.trim() !== file.name) {
      try {
        await renameFile.mutateAsync({ id: file.id, name: name.trim() });
      } catch (err) {
        toast({ message: errMsg(err, "Couldn’t rename the file."), variant: "error" });
      }
    }
  };

  const deleteFolderItem = async (folder: DriveFolder) => {
    const ok = await confirm({
      title: `Delete “${folder.name}”?`,
      message: "This permanently deletes the folder and everything inside it.",
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) {
      try {
        await deleteFolder.mutateAsync(folder.id);
      } catch (err) {
        toast({ message: errMsg(err, "Couldn’t delete the folder."), variant: "error" });
      }
    }
  };

  const deleteFileItem = async (file: FileItem) => {
    const ok = await confirm({
      title: `Delete “${file.name}”?`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) {
      try {
        await deleteFile.mutateAsync(file.id);
      } catch (err) {
        toast({ message: errMsg(err, "Couldn’t delete the file."), variant: "error" });
      }
    }
  };

  const runMove = async (dest: number | null) => {
    if (!moving) return;
    try {
      for (const id of moving.fileIds) await moveFile.mutateAsync({ id, folderId: dest });
      for (const id of moving.folderIds) await moveFolder.mutateAsync({ id, parentId: dest });
      const n = moving.fileIds.length + moving.folderIds.length;
      toast({ message: `Moved ${n} item${n === 1 ? "" : "s"}.`, variant: "success" });
      setSelFolders(new Set());
      setSelFiles(new Set());
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t move the items."), variant: "error" });
    } finally {
      setMoving(null);
    }
  };

  const bulkDelete = async () => {
    const n = selFolders.size + selFiles.size;
    const ok = await confirm({
      title: `Delete ${n} item${n === 1 ? "" : "s"}?`,
      message: "Selected folders are deleted with everything inside them. This can't be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      for (const id of selFiles) await deleteFile.mutateAsync(id);
      for (const id of selFolders) await deleteFolder.mutateAsync(id);
      toast({ message: `Deleted ${n} item${n === 1 ? "" : "s"}.`, variant: "success" });
      setSelFolders(new Set());
      setSelFiles(new Set());
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t delete the items."), variant: "error" });
    }
  };

  const toggleFolder = (id: number) =>
    setSelFolders((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleFile = (id: number) =>
    setSelFiles((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // In a flat view (Recent/Starred) there are no folders or breadcrumb — just a
  // cross-folder file list from the matching query.
  const flatQuery = flatView === "recent" ? recent : flatView === "starred" ? starred : null;
  const isLoading = flatView ? (flatQuery?.isLoading ?? false) : browse.isLoading;
  const listing = browse.data;
  const folders = useMemo(
    () => (flatView ? [] : sortFolders(listing?.folders ?? [], sort)),
    [flatView, listing, sort],
  );
  const rawFiles = flatView ? (flatQuery?.data?.files ?? []) : (listing?.files ?? []);
  const sortedFiles = useMemo(() => sortFiles(rawFiles, sort), [rawFiles, sort]);
  // Cross-app items (docs/decks/notes): root + flat views only.
  const rawAppItems = flatView ? (flatQuery?.data?.appItems ?? []) : (listing?.appItems ?? []);
  const matchesTags = (tags: Tag[]) => {
    if (tagFilter.size === 0) return true;
    const ids = new Set(tags.map((t) => t.id));
    return [...tagFilter].every((id) => ids.has(id));
  };
  // Tag filter applies to files only (folders aren't taggable).
  const files = useMemo(
    () => sortedFiles.filter((f) => matchesTags(f.tags)),
    [sortedFiles, tagFilter],
  );
  const appItems = useMemo(() => {
    const arr = [...rawAppItems].filter((it) => matchesTags(it.tags));
    arr.sort((a, b) =>
      sort === "modified" ? b.updatedAt.localeCompare(a.updatedAt) : a.name.localeCompare(b.name),
    );
    return arr;
  }, [rawAppItems, sort, tagFilter]);
  const breadcrumb = listing?.breadcrumb ?? [];
  const isEmpty =
    !isLoading && folders.length === 0 && sortedFiles.length === 0 && rawAppItems.length === 0;
  const noFileMatches =
    tagFilter.size > 0 && files.length === 0 && appItems.length === 0 && (sortedFiles.length > 0 || rawAppItems.length > 0);
  const selCount = selFolders.size + selFiles.size;

  return (
    <div
      className="relative mx-auto max-w-6xl px-6 py-6"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* Toolbar + breadcrumb */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {flatView ? (
            <h1 className="text-xl font-semibold tracking-tight">{FLAT_TITLES[flatView]}</h1>
          ) : (
            <>
              <Menu>
                <MenuTrigger>
                  <Button size="sm" className="shrink-0">
                    <Plus /> New <ChevronDown className="!size-3.5 opacity-70" />
                  </Button>
                </MenuTrigger>
                <MenuContent align="start">
                  <MenuItem icon={<FileUp />} onSelect={() => fileRef.current?.click()}>
                    File upload
                  </MenuItem>
                  <MenuItem icon={<FolderUp />} onSelect={() => folderRef.current?.click()}>
                    Folder upload
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<FileText />} onSelect={() => onNewFlatfile?.()}>
                    Flatfile
                  </MenuItem>
                  <MenuItem icon={<Presentation />} onSelect={() => onNewFlatdeck?.()}>
                    Flatdeck
                  </MenuItem>
                  <MenuItem icon={<Lightbulb />} onSelect={() => onNewFlatthought?.()}>
                    Flatthought
                  </MenuItem>
                </MenuContent>
              </Menu>
              <nav className="flex min-w-0 items-center gap-1 text-sm">
                <button
                  onClick={() => onOpenFolder(null)}
                  className="flex items-center gap-1.5 rounded px-1.5 py-1 text-muted-foreground transition hover:text-foreground [&_svg]:size-4"
                >
                  <HardDrive /> FlatDrive
                </button>
                {breadcrumb.map((f) => (
                  <span key={f.id} className="flex min-w-0 items-center gap-1">
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
                    <button
                      onClick={() => onOpenFolder(f.id)}
                      className={cn(
                        "truncate rounded px-1.5 py-1 transition hover:text-foreground",
                        f.id === folderId ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {f.name}
                    </button>
                  </span>
                ))}
              </nav>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Menu>
            <MenuTrigger>
              <Button variant="outline" size="sm" className="text-muted-foreground">
                <ArrowUpDown /> {SORT_LABELS[sort]}
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>Sort by</MenuLabel>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <MenuItem key={k} icon={sort === k ? <Check /> : <span className="size-4" />} onSelect={() => setSort(k)}>
                  {SORT_LABELS[k]}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <Button
            variant="outline"
            size="sm"
            aria-label={view === "grid" ? "Switch to list view" : "Switch to grid view"}
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            className="px-2 text-muted-foreground"
          >
            {view === "grid" ? <ListIcon /> : <LayoutGrid />}
          </Button>
          {!flatView && (
            <Button variant="outline" size="sm" onClick={newFolder}>
              <FolderPlus /> New folder
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={folderRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void uploadFolder(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {(allTags.data?.length ?? 0) > 0 && (
        <TagFilterBar
          tags={allTags.data!}
          selected={tagFilter}
          onToggle={toggleTagFilter}
          onClear={() => setTagFilter(new Set())}
          className="mb-4"
        />
      )}
      {noFileMatches && (
        <p className="mb-4 text-sm text-muted-foreground">
          No files match the selected tag{tagFilter.size === 1 ? "" : "s"}.
        </p>
      )}

      {/* Selection bar */}
      {selCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{selCount} selected</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMoving({ fileIds: [...selFiles], folderIds: [...selFolders] })}
            >
              <FolderInput /> Move
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" onClick={bulkDelete}>
              <Trash2 /> Delete
            </Button>
            <button
              onClick={() => {
                setSelFolders(new Set());
                setSelFiles(new Set());
              }}
              aria-label="Clear selection"
              className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-4"
            >
              <X />
            </button>
          </div>
        </div>
      )}

      {upload.isPending && <p className="mb-3 text-xs text-muted-foreground">Uploading…</p>}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {flatView === "starred" ? <Star className="size-6" /> : <Upload className="size-6" />}
          </div>
          <h3 className="text-base font-medium">
            {flatView === "recent"
              ? "No files yet"
              : flatView === "starred"
                ? "No starred files"
                : "This folder is empty"}
          </h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {flatView === "starred"
              ? "Star a file to find it here quickly."
              : flatView === "recent"
                ? "Files you upload will show up here, newest first."
                : "Drag files here, or use the New menu to upload."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {folders.map((folder) => (
            <FolderCard
              key={`d${folder.id}`}
              folder={folder}
              selected={selFolders.has(folder.id)}
              onOpen={() => onOpenFolder(folder.id)}
              onToggleSelect={() => toggleFolder(folder.id)}
              onRename={() => renameFolderItem(folder)}
              onMove={() => setMoving({ fileIds: [], folderIds: [folder.id] })}
              onDelete={() => deleteFolderItem(folder)}
            />
          ))}
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              selected={selFiles.has(file.id)}
              onOpen={() => onOpenFile(file.id)}
              onToggleSelect={() => toggleFile(file.id)}
              onToggleStar={() => toggleStar.mutate(file.id)}
              onRename={() => renameFileItem(file)}
              onMove={() => setMoving({ fileIds: [file.id], folderIds: [] })}
              onDelete={() => deleteFileItem(file)}
            />
          ))}
          {appItems.map((item) => (
            <AppItemCard key={`${item.kind}-${item.id}`} item={item} onOpen={() => onOpenAppItem?.(item)} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {folders.map((folder, i) => (
            <ListRow
              key={`d${folder.id}`}
              icon={<HardDrive className="text-primary/70" />}
              name={folder.name}
              meta={formatDate(folder.createdAt)}
              first={i === 0}
              selected={selFolders.has(folder.id)}
              onOpen={() => onOpenFolder(folder.id)}
              onToggleSelect={() => toggleFolder(folder.id)}
              onRename={() => renameFolderItem(folder)}
              onMove={() => setMoving({ fileIds: [], folderIds: [folder.id] })}
              onDelete={() => deleteFolderItem(folder)}
            />
          ))}
          {files.map((file, i) => {
            const Icon = iconFor(file.mime, file.name);
            return (
              <ListRow
                key={file.id}
                icon={<Icon className="text-muted-foreground/60" />}
                name={file.name}
                meta={`${formatBytes(file.size)} · ${formatDate(file.updatedAt)}`}
                first={folders.length === 0 && i === 0}
                selected={selFiles.has(file.id)}
                tags={file.tags}
                tagPicker={
                  <TagPicker
                    entityType="file"
                    entityId={file.id}
                    current={file.tags}
                    align="end"
                    trigger={
                      <span className="flex shrink-0 items-center rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100 [&_svg]:size-3.5">
                        <TagIcon />
                      </span>
                    }
                  />
                }
                starred={file.starred}
                onOpen={() => onOpenFile(file.id)}
                onToggleSelect={() => toggleFile(file.id)}
                onToggleStar={() => toggleStar.mutate(file.id)}
                onRename={() => renameFileItem(file)}
                onMove={() => setMoving({ fileIds: [file.id], folderIds: [] })}
                onDelete={() => deleteFileItem(file)}
              />
            );
          })}
          {appItems.map((item, i) => (
            <AppItemRow
              key={`${item.kind}-${item.id}`}
              item={item}
              first={folders.length === 0 && files.length === 0 && i === 0}
              onOpen={() => onOpenAppItem?.(item)}
            />
          ))}
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5 text-sm font-medium text-primary">
          Drop files to upload
        </div>
      )}

      {moving && (
        <MoveDialog
          target={
            {
              folderIds: moving.folderIds,
              sourceFolderId: folderId,
              count: moving.fileIds.length + moving.folderIds.length,
            } satisfies MoveTarget
          }
          onMove={runMove}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  );
}

interface ItemActions {
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  /** Files only — folders aren't starrable. */
  onToggleStar?: () => void;
}

function SelectBox({ selected, onToggle }: { selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={selected ? "Deselect" : "Select"}
      className={cn(
        "flex size-5 items-center justify-center rounded border transition [&_svg]:size-3.5",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background/80 text-transparent opacity-0 backdrop-blur group-hover:opacity-100",
      )}
    >
      <Check />
    </button>
  );
}

function CardMenu({
  onRename,
  onMove,
  onDelete,
  onToggleStar,
  starred,
  className = "absolute right-1.5 top-1.5",
}: Pick<ItemActions, "onRename" | "onMove" | "onDelete" | "onToggleStar"> & {
  starred?: boolean;
  className?: string;
}) {
  return (
    <Menu className={cn(className, "opacity-0 transition group-hover:opacity-100")}>
      <MenuTrigger>
        <span className="flex size-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground [&_svg]:size-4">
          <MoreVertical />
        </span>
      </MenuTrigger>
      <MenuContent align="end">
        {onToggleStar && (
          <MenuItem icon={<Star />} onSelect={onToggleStar}>
            {starred ? "Remove star" : "Star"}
          </MenuItem>
        )}
        <MenuItem onSelect={onRename}>Rename</MenuItem>
        <MenuItem onSelect={onMove}>Move to…</MenuItem>
        <MenuItem destructive onSelect={onDelete}>
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function FolderCard({ folder, ...a }: { folder: DriveFolder } & ItemActions) {
  return (
    <div className="group relative">
      <button
        onClick={a.onOpen}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border bg-card px-3 py-4 text-left transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 [&_svg]:size-5 [&_svg]:text-primary/70",
          a.selected ? "border-primary" : "border-border",
        )}
      >
        <HardDrive />
        <span className="truncate text-sm font-medium">{folder.name}</span>
      </button>
      <div className="absolute left-1.5 top-1.5">
        <SelectBox selected={a.selected} onToggle={a.onToggleSelect} />
      </div>
      <CardMenu onRename={a.onRename} onMove={a.onMove} onDelete={a.onDelete} />
    </div>
  );
}

function FileCard({ file, ...a }: { file: FileItem } & ItemActions) {
  const Icon = iconFor(file.mime, file.name);
  const isImage = previewKind(file.mime, file.name) === "image";
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
        a.selected ? "border-primary" : "border-border",
      )}
    >
      <button onClick={a.onOpen} className="block w-full text-left">
        <div className="flex aspect-[4/3] items-center justify-center border-b border-border bg-background/60">
          {isImage ? (
            <img src={fileRawUrl(file.id)} alt={file.name} className="size-full object-cover" loading="lazy" />
          ) : (
            <Icon className="size-9 text-muted-foreground/40" />
          )}
        </div>
        <div className="px-3 pt-2">
          <div className="truncate text-sm font-medium">{file.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatBytes(file.size)} · {formatDate(file.updatedAt)}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1.5 px-3 pb-2 pt-1.5">
        <div className="min-w-0 flex-1">
          <TagChips tags={file.tags} max={2} className="flex-nowrap" />
        </div>
        <TagPicker
          entityType="file"
          entityId={file.id}
          current={file.tags}
          align="end"
          trigger={
            <span className="flex items-center rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100 [&_svg]:size-3.5">
              <TagIcon />
            </span>
          }
        />
      </div>
      <div className="absolute left-1.5 top-1.5">
        <SelectBox selected={a.selected} onToggle={a.onToggleSelect} />
      </div>
      {a.onToggleStar && (
        <button
          onClick={a.onToggleStar}
          aria-label={file.starred ? "Remove star" : "Star"}
          className={cn(
            "absolute right-10 top-1.5 flex size-7 items-center justify-center rounded-md bg-background/80 backdrop-blur transition [&_svg]:size-4",
            file.starred
              ? "text-amber-400 [&_svg]:fill-amber-400"
              : "text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100",
          )}
        >
          <Star />
        </button>
      )}
      <CardMenu
        onRename={a.onRename}
        onMove={a.onMove}
        onDelete={a.onDelete}
        onToggleStar={a.onToggleStar}
        starred={file.starred}
      />
    </div>
  );
}

function ListRow({
  icon,
  name,
  meta,
  first,
  tags,
  tagPicker,
  starred,
  ...a
}: {
  icon: React.ReactNode;
  name: string;
  meta: string;
  first: boolean;
  tags?: Tag[];
  tagPicker?: React.ReactNode;
  starred?: boolean;
} & ItemActions) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 transition hover:bg-accent/40",
        !first && "border-t border-border",
        a.selected && "bg-primary/5",
      )}
    >
      <SelectBox selected={a.selected} onToggle={a.onToggleSelect} />
      <button onClick={a.onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 text-left [&_svg]:size-4">
        {icon}
        <span className="truncate text-sm font-medium">{name}</span>
      </button>
      {tags && tags.length > 0 && (
        <div className="hidden max-w-[40%] overflow-hidden md:block">
          <TagChips tags={tags} max={3} className="flex-nowrap" />
        </div>
      )}
      {tagPicker}
      <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
      <CardMenu
        className="relative shrink-0"
        onRename={a.onRename}
        onMove={a.onMove}
        onDelete={a.onDelete}
        onToggleStar={a.onToggleStar}
        starred={starred}
      />
    </div>
  );
}
