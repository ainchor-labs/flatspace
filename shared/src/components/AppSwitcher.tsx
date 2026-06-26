/**
 * App switcher — a full-width dropdown that switches between the suite's apps
 * (Flatfile, Flatdeck, Flatdrive, Flatthoughts). It lives at the top of the
 * persistent sidebar; the trigger shows the current app, the menu lists them all.
 *
 * Presentational: the host (web shell) passes the current app + an onSelect
 * callback so this stays decoupled from any router.
 */

import { Check, ChevronsUpDown, FileText, HardDrive, Lightbulb, Presentation } from "lucide-react";
import type { AppId } from "../types/index.ts";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./ui/menu.tsx";

const APPS: { id: AppId; label: string; icon: typeof FileText }[] = [
  { id: "flatfile", label: "Flatfile", icon: FileText },
  { id: "flatdeck", label: "Flatdeck", icon: Presentation },
  { id: "flatdrive", label: "Flatdrive", icon: HardDrive },
  { id: "flatthoughts", label: "Flatthoughts", icon: Lightbulb },
];

export function AppSwitcher({
  current,
  onSelect,
}: {
  current: AppId;
  onSelect: (app: AppId) => void;
}) {
  const active = APPS.find((a) => a.id === current) ?? APPS[0]!;
  const ActiveIcon = active.icon;

  return (
    <Menu>
      <MenuTrigger>
        <button className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-sm font-medium transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4">
          <ActiveIcon className="text-primary" />
          <span className="flex-1 truncate text-left">{active.label}</span>
          <ChevronsUpDown className="!size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="min-w-52">
        {APPS.map(({ id, label, icon: Icon }) => (
          <MenuItem key={id} icon={<Icon />} onSelect={() => onSelect(id)}>
            <span className="flex-1 text-left">{label}</span>
            {id === current && <Check />}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
