/**
 * Flatfile sub-dashboard page: shared shell + Flatfile sidebar + file browser.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell, useDialog, useToast } from "@flatspace/shared/ui";
import { ApiRequestError } from "@flatspace/shared/lib";
import type { Folder, User } from "@flatspace/shared/types";
import {
  FlatfileDashboard,
  FlatfileSidebar,
  useCreateDocument,
  useCreateFolder,
  useDeleteFolder,
  useFolders,
  useRenameFolder,
  type FlatfileView,
} from "@flatspace/flatfile/client";
import { useShell } from "../hooks/useShell.ts";

export function FlatfilePage({ user }: { user: User }) {
  const { shell } = useShell(user);
  const navigate = useNavigate();
  const [view, setView] = useState<FlatfileView>("recent");
  const folders = useFolders();
  const createDoc = useCreateDocument();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const { toast } = useToast();
  const { confirm, prompt } = useDialog();

  const openDoc = (id: number) => navigate(`/flatfile/doc/${id}`);
  const errMsg = (err: unknown, fallback: string) =>
    err instanceof ApiRequestError ? err.message : fallback;

  async function handleNewFolder() {
    const name = await prompt({ title: "New folder", placeholder: "Folder name", confirmText: "Create" });
    if (!name?.trim()) return;
    try {
      await createFolder.mutateAsync(name.trim());
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t create the folder."), variant: "error" });
    }
  }

  async function handleRenameFolder(folder: Folder) {
    const name = await prompt({ title: "Rename folder", defaultValue: folder.name, confirmText: "Rename" });
    if (!name?.trim() || name.trim() === folder.name) return;
    try {
      await renameFolder.mutateAsync({ id: folder.id, name: name.trim() });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t rename the folder."), variant: "error" });
    }
  }

  async function handleDeleteFolder(folder: Folder) {
    const ok = await confirm({
      title: `Delete “${folder.name}”?`,
      message: "The folder is removed; documents inside it move back to All documents.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteFolder.mutateAsync(folder.id);
      if (typeof view === "object" && view.folderId === folder.id) setView("all");
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t delete the folder."), variant: "error" });
    }
  }

  return (
    <AppShell
      {...shell}
      sidebar={
        <FlatfileSidebar
          view={view}
          onSelect={setView}
          folders={folders.data ?? []}
          onNewDocument={async () => openDoc((await createDoc.mutateAsync({})).id)}
          onNewFolder={handleNewFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
        />
      }
    >
      <FlatfileDashboard view={view} onOpenDoc={openDoc} folders={folders.data ?? []} />
    </AppShell>
  );
}
