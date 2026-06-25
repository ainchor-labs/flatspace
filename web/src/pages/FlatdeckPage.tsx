/**
 * Flatdeck sub-dashboard page: shared shell + presentation browser.
 */

import { useNavigate } from "react-router-dom";
import { AppShell } from "@flatspace/shared/ui";
import type { User } from "@flatspace/shared/types";
import { FlatdeckDashboard } from "@flatspace/flatdeck/client";
import { useShell } from "../hooks/useShell.ts";

export function FlatdeckPage({ user }: { user: User }) {
  const { shell } = useShell(user);
  const navigate = useNavigate();
  return (
    <AppShell {...shell}>
      <FlatdeckDashboard onOpenDeck={(id) => navigate(`/flatdeck/deck/${id}`)} />
    </AppShell>
  );
}
