/**
 * Flatdeck sub-dashboard page: shared shell + Flatdeck sidebar + presentation browser.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@flatspace/shared/ui";
import type { User } from "@flatspace/shared/types";
import {
  FlatdeckDashboard,
  FlatdeckSidebar,
  useCreateDeck,
  type FlatdeckView,
} from "@flatspace/flatdeck/client";
import { useShell } from "../hooks/useShell.ts";

export function FlatdeckPage({ user }: { user: User }) {
  const { shell } = useShell(user);
  const navigate = useNavigate();
  const [view, setView] = useState<FlatdeckView>("recent");
  const createDeck = useCreateDeck();

  const openDeck = (id: number) => navigate(`/flatdeck/deck/${id}`);

  return (
    <AppShell
      {...shell}
      sidebar={
        <FlatdeckSidebar
          view={view}
          onSelect={setView}
          onNewDeck={async () => openDeck((await createDeck.mutateAsync({})).id)}
        />
      }
    >
      <FlatdeckDashboard view={view} onOpenDeck={openDeck} />
    </AppShell>
  );
}
