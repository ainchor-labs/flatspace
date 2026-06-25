/**
 * Flatdrive sub-dashboard page: shared shell + Flatdrive sidebar + file browser.
 * Owns the current-folder state shared between the sidebar and the browser.
 */

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@flatspace/shared/ui";
import type { User } from "@flatspace/shared/types";
import { FlatdriveDashboard, FlatdriveSidebar } from "@flatspace/flatdrive/client";
import { useCreateDocument } from "@flatspace/flatfile/client";
import { useCreateDeck } from "@flatspace/flatdeck/client";
import { useShell } from "../hooks/useShell.ts";

export function FlatdrivePage({ user }: { user: User }) {
  const { shell } = useShell(user);
  const navigate = useNavigate();
  const [folderId, setFolderId] = useState<number | null>(null);
  // The sidebar's Upload button opens the dashboard's file picker.
  const uploadTrigger = useRef<() => void>(() => {});
  // "New" dropdown actions that create docs/decks in the sibling apps.
  const createDoc = useCreateDocument();
  const createDeck = useCreateDeck();

  return (
    <AppShell
      {...shell}
      sidebar={
        <FlatdriveSidebar
          folderId={folderId}
          onOpenFolder={setFolderId}
          onUpload={() => uploadTrigger.current()}
        />
      }
    >
      <FlatdriveDashboard
        folderId={folderId}
        onOpenFolder={setFolderId}
        onOpenFile={(id) => navigate(`/flatdrive/file/${id}`)}
        registerUpload={(fn) => (uploadTrigger.current = fn)}
        onNewFlatfile={async () => navigate(`/flatfile/doc/${(await createDoc.mutateAsync({})).id}`)}
        onNewFlatdeck={async () => navigate(`/flatdeck/deck/${(await createDeck.mutateAsync({})).id}`)}
      />
    </AppShell>
  );
}
