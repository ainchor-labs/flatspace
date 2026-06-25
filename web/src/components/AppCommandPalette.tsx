/**
 * Wires the shared CommandPalette (⌘K / Ctrl+K) with the suite's quick actions:
 * create docs/decks, jump between apps, open settings/admin, log out.
 * Mounted once for authenticated users in App.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, HardDrive, LogOut, Plus, Presentation, Settings, Users } from "lucide-react";
import { CommandPalette, type Command } from "@flatspace/shared/ui";
import { useLogout } from "@flatspace/shared/lib";
import type { User } from "@flatspace/shared/types";
import { useCreateDocument } from "@flatspace/flatfile/client";
import { useCreateDeck } from "@flatspace/flatdeck/client";

export function AppCommandPalette({ user }: { user: User }) {
  const navigate = useNavigate();
  const createDoc = useCreateDocument();
  const createDeck = useCreateDeck();
  const logout = useLogout();

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: "new-doc",
        label: "New document",
        hint: "Flatfile",
        icon: <Plus />,
        run: async () => navigate(`/flatfile/doc/${(await createDoc.mutateAsync({})).id}`),
      },
      {
        id: "new-deck",
        label: "New presentation",
        hint: "Flatdeck",
        icon: <Plus />,
        run: async () => navigate(`/flatdeck/deck/${(await createDeck.mutateAsync({})).id}`),
      },
      { id: "go-drive", label: "Go to Flatdrive", icon: <HardDrive />, run: () => navigate("/flatdrive") },
      { id: "go-file", label: "Go to Flatfile", icon: <FileText />, run: () => navigate("/flatfile") },
      { id: "go-deck", label: "Go to Flatdeck", icon: <Presentation />, run: () => navigate("/flatdeck") },
      { id: "settings", label: "Account settings", icon: <Settings />, run: () => navigate("/settings") },
    ];
    if (user.role === "admin") {
      list.push({ id: "users", label: "Manage users", icon: <Users />, run: () => navigate("/admin/users") });
    }
    list.push({
      id: "logout",
      label: "Log out",
      icon: <LogOut />,
      run: async () => {
        await logout.mutateAsync();
        navigate("/");
      },
    });
    return list;
  }, [navigate, createDoc, createDeck, logout, user.role]);

  return <CommandPalette commands={commands} />;
}
