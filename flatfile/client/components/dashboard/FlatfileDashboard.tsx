/**
 * Flatfile dashboard — the file browser content area.
 *
 * Renders the active view (Recent / All / Starred / a folder) as a responsive
 * grid of document cards, with a header + "New document" action and graceful
 * loading / empty states. View selection is owned by the page so it can be
 * shared with the sidebar; data flows through the Flatfile query hooks.
 */

import { useState } from "react";
import { FilePlus2, FileText } from "lucide-react";
import type { DocumentSummary, Folder } from "@flatspace/shared/types";
import { Button, TagFilterBar, useDialog, useToast } from "@flatspace/shared/ui";
import { ApiRequestError, useTags } from "@flatspace/shared/lib";
import {
  useCreateDocument,
  useDeleteDocument,
  useDocuments,
  useDuplicateDocument,
  useMoveDocument,
  useRecentDocuments,
  useRenameDocument,
  useToggleStar,
} from "../../hooks/useFlatfile.ts";
import type { FlatfileView } from "./FlatfileSidebar.tsx";
import { DocCard } from "./DocCard.tsx";
import { MoveToFolderDialog } from "./MoveToFolderDialog.tsx";

const TITLES: Record<string, string> = {
  recent: "Recent",
  all: "All documents",
  starred: "Starred",
};

function useViewData(view: FlatfileView) {
  const isFolder = typeof view === "object";
  const recent = useRecentDocuments();
  const list = useDocuments(
    isFolder
      ? { folderId: view.folderId }
      : view === "starred"
        ? { starred: true }
        : view === "all"
          ? {}
          : { folderId: undefined },
  );
  if (view === "recent") return recent;
  return list;
}

export function FlatfileDashboard({
  view,
  onOpenDoc,
  folders = [],
}: {
  view: FlatfileView;
  onOpenDoc: (id: number) => void;
  folders?: Folder[];
}) {
  const query = useViewData(view);
  const allTags = useTags();
  const createDoc = useCreateDocument();
  const toggleStar = useToggleStar();
  const renameDoc = useRenameDocument();
  const duplicateDoc = useDuplicateDocument();
  const moveDoc = useMoveDocument();
  const deleteDoc = useDeleteDocument();
  const { toast } = useToast();
  const { confirm, prompt } = useDialog();
  const [moving, setMoving] = useState<DocumentSummary | null>(null);
  const [filter, setFilter] = useState<Set<number>>(new Set());

  const title = typeof view === "object" ? "Folder" : (TITLES[view] ?? "Documents");
  const all = (query.data ?? []) as DocumentSummary[];
  const docs =
    filter.size === 0
      ? all
      : all.filter((d) => {
          const ids = new Set(d.tags.map((t) => t.id));
          return [...filter].every((id) => ids.has(id));
        });
  const toggleFilter = (id: number) =>
    setFilter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function handleNew() {
    const doc = await createDoc.mutateAsync({});
    onOpenDoc(doc.id);
  }

  function errMsg(err: unknown, fallback: string): string {
    return err instanceof ApiRequestError ? err.message : fallback;
  }

  async function handleRename(doc: DocumentSummary) {
    const title = await prompt({
      title: "Rename document",
      defaultValue: doc.title,
      confirmText: "Rename",
    });
    if (title == null || !title.trim() || title.trim() === doc.title) return;
    try {
      await renameDoc.mutateAsync({ id: doc.id, title: title.trim() });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t rename the document."), variant: "error" });
    }
  }

  async function handleDuplicate(doc: DocumentSummary) {
    try {
      await duplicateDoc.mutateAsync(doc.id);
      toast({ message: `Duplicated “${doc.title}”.`, variant: "success" });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t duplicate the document."), variant: "error" });
    }
  }

  async function handleMoveTo(folderId: number | null) {
    if (!moving) return;
    const doc = moving;
    setMoving(null);
    if ((doc.folderId ?? null) === folderId) return;
    try {
      await moveDoc.mutateAsync({ id: doc.id, folderId });
      const dest = folderId === null ? "All documents" : folders.find((f) => f.id === folderId)?.name;
      toast({ message: `Moved “${doc.title}”${dest ? ` to ${dest}` : ""}.`, variant: "success" });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t move the document."), variant: "error" });
    }
  }

  async function handleDelete(doc: DocumentSummary) {
    const ok = await confirm({
      title: `Delete “${doc.title}”?`,
      message: "This permanently deletes the document and its version history.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDoc.mutateAsync(doc.id);
      toast({ message: `Deleted “${doc.title}”.`, variant: "success" });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t delete the document."), variant: "error" });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {query.isLoading
              ? "Loading…"
              : filter.size > 0
                ? `${docs.length} of ${all.length} document${all.length === 1 ? "" : "s"}`
                : `${all.length} document${all.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button onClick={handleNew} disabled={createDoc.isPending}>
          <FilePlus2 /> New document
        </Button>
      </div>

      {(allTags.data?.length ?? 0) > 0 && (
        <TagFilterBar
          tags={allTags.data!}
          selected={filter}
          onToggle={toggleFilter}
          onClear={() => setFilter(new Set())}
          className="mb-5"
        />
      )}

      {query.isLoading ? (
        <SkeletonGrid />
      ) : all.length === 0 ? (
        <EmptyState onNew={handleNew} />
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No documents match the selected tag{filter.size === 1 ? "" : "s"}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {docs.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
              onOpen={onOpenDoc}
              onToggleStar={(id) => toggleStar.mutate(id)}
              onRename={handleRename}
              onDuplicate={handleDuplicate}
              onMove={setMoving}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {moving && (
        <MoveToFolderDialog
          docTitle={moving.title}
          folders={folders}
          currentFolderId={moving.folderId ?? null}
          onSelect={handleMoveTo}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-xl border border-border bg-card" />
      ))}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FileText className="size-6" />
      </div>
      <h3 className="text-base font-medium">No documents yet</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Create your first markdown document and start writing.
      </p>
      <Button className="mt-5" onClick={onNew}>
        <FilePlus2 /> New document
      </Button>
    </div>
  );
}
