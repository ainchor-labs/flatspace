/**
 * Flatthoughts sub-dashboard page (screen 1): shared shell + the wall of notes.
 */

import { useNavigate } from "react-router-dom";
import { AppShell } from "@flatspace/shared/ui";
import type { User } from "@flatspace/shared/types";
import { FlatthoughtsDashboard } from "@flatspace/flatthoughts/client";
import { useShell } from "../hooks/useShell.ts";

export function FlatthoughtsPage({ user }: { user: User }) {
  const { shell } = useShell(user);
  const navigate = useNavigate();
  return (
    <AppShell {...shell}>
      <FlatthoughtsDashboard
        onOpenThought={(id) => navigate(`/flatthoughts/thought/${id}`)}
        onNew={() => navigate("/flatthoughts/new")}
        onTriage={() => navigate("/flatthoughts/triage")}
      />
    </AppShell>
  );
}
