/**
 * Flatthoughts sub-dashboard page (screen 1): shared shell + the wall of notes.
 */

import { useNavigate } from "react-router-dom";
import { AppShell } from "@flatspace/shared/ui";
import type { User } from "@flatspace/shared/types";
import { FlatthoughtsDashboard, FlatthoughtsSidebar } from "@flatspace/flatthoughts/client";
import { useShell } from "../hooks/useShell.ts";

export function FlatthoughtsPage({ user }: { user: User }) {
  const { shell } = useShell(user);
  const navigate = useNavigate();
  const newThought = () => navigate("/flatthoughts/new");
  const triage = () => navigate("/flatthoughts/triage");
  return (
    <AppShell {...shell} sidebar={<FlatthoughtsSidebar onNew={newThought} onTriage={triage} />}>
      <FlatthoughtsDashboard
        onOpenThought={(id) => navigate(`/flatthoughts/thought/${id}`)}
        onNew={newThought}
        onTriage={triage}
      />
    </AppShell>
  );
}
