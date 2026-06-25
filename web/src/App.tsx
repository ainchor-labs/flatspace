/**
 * App root: auth gate + route table.
 *
 * While the session loads we show a minimal splash. Unauthenticated users get
 * the shared AuthScreen; authenticated users get the suite (Flatfile + Flatdeck
 * + Flatdrive dashboards and editor routes). "/" redirects into Flatdrive.
 */

import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useCurrentUser } from "@flatspace/shared/lib";
import { AuthScreen, Logo } from "@flatspace/shared/ui";
import { FlatfilePage } from "./pages/FlatfilePage.tsx";
import { FlatdeckPage } from "./pages/FlatdeckPage.tsx";
import { FlatdrivePage } from "./pages/FlatdrivePage.tsx";
import { AdminUsersPage } from "./pages/AdminUsersPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { SearchResultsPage } from "./pages/SearchResultsPage.tsx";
import { AppCommandPalette } from "./components/AppCommandPalette.tsx";

// The TipTap editor (with lowlight) is heavy — load it only on the editor route.
const DocumentEditorPage = lazy(() =>
  import("./pages/DocumentEditorPage.tsx").then((m) => ({ default: m.DocumentEditorPage })),
);

// The deck editor pulls in markdown-it — lazy-load it only on the deck route.
const DeckEditorPage = lazy(() =>
  import("./pages/DeckEditorPage.tsx").then((m) => ({ default: m.DeckEditorPage })),
);

// The file preview pulls in highlight.js — lazy-load it only on the preview route.
const FilePreviewPage = lazy(() =>
  import("./pages/FilePreviewPage.tsx").then((m) => ({ default: m.FilePreviewPage })),
);

function EditorLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading editor…
    </div>
  );
}

export function App() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse">
          <Logo />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <>
      <AppCommandPalette user={user} />
      <Routes>
      <Route path="/" element={<Navigate to="/flatdrive" replace />} />
      <Route path="/flatfile" element={<FlatfilePage user={user} />} />
      <Route
        path="/flatfile/doc/:id"
        element={
          <Suspense fallback={<EditorLoading />}>
            <DocumentEditorPage />
          </Suspense>
        }
      />
      <Route path="/flatdeck" element={<FlatdeckPage user={user} />} />
      <Route
        path="/flatdeck/deck/:id"
        element={
          <Suspense fallback={<EditorLoading />}>
            <DeckEditorPage />
          </Suspense>
        }
      />
      <Route path="/flatdrive" element={<FlatdrivePage user={user} />} />
      <Route path="/admin/users" element={<AdminUsersPage user={user} />} />
      <Route path="/settings" element={<SettingsPage user={user} />} />
      <Route path="/search" element={<SearchResultsPage user={user} />} />
      <Route
        path="/flatdrive/file/:id"
        element={
          <Suspense fallback={<EditorLoading />}>
            <FilePreviewPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/flatdrive" replace />} />
      </Routes>
    </>
  );
}
