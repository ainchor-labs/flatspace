/**
 * Flatdrive sub-dashboard page: shared shell + Flatdrive sidebar + file browser.
 * Owns the current view — either a folder being browsed (null = root) or a flat
 * cross-folder view (Recent / Starred) — shared between the sidebar and browser.
 */

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@flatspace/shared/ui";
import type { User } from "@flatspace/shared/types";
import { FlatdriveDashboard, FlatdriveSidebar, type FlatdriveView } from "@flatspace/flatdrive/client";
import { useCreateDocument } from "@flatspace/flatfile/client";
import { useCreateDeck } from "@flatspace/flatdeck/client";
import { useShell } from "../hooks/useShell.ts";

export function FlatdrivePage({ user }: { user: User }) {
  const { shell } = useShell(user);
  const navigate = useNavigate();
  const [view, setView] = useState<FlatdriveView>({ folderId: null });
  // The sidebar's Upload button opens the dashboard's file picker.
  const uploadTrigger = useRef<() => void>(() => {});
  // "New" dropdown actions that create docs/decks in the sibling apps.
  const createDoc = useCreateDocument();
  const createDeck = useCreateDeck();

  // Browsing a folder vs a flat (Recent/Starred) view.
  const isBrowse = typeof view === "object";
  const folderId = isBrowse ? view.folderId : null;
  const flatView = isBrowse ? null : view;

  return (
    <AppShell
      {...shell}
      sidebar={
        <FlatdriveSidebar
          view={view}
          onSelect={setView}
          onUpload={() => uploadTrigger.current()}
        />
      }
    >
      <FlatdriveDashboard
        folderId={folderId}
        flatView={flatView}
        onOpenFolder={(id) => setView({ folderId: id })}
        onOpenFile={(id) => navigate(`/flatdrive/file/${id}`)}
        onOpenAppItem={(item) =>
          navigate(
            item.kind === "flatfile"
              ? `/flatfile/doc/${item.id}`
              : item.kind === "flatdeck"
                ? `/flatdeck/deck/${item.id}`
                : `/flatthoughts/thought/${item.id}`,
          )
        }
        registerUpload={(fn) => (uploadTrigger.current = fn)}
        onNewFlatfile={async () => navigate(`/flatfile/doc/${(await createDoc.mutateAsync({})).id}`)}
        onNewFlatdeck={async () => navigate(`/flatdeck/deck/${(await createDeck.mutateAsync({})).id}`)}
        onNewFlatthought={() => navigate("/flatthoughts/new")}
      />
    </AppShell>
  );
}
