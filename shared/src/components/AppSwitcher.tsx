/**
 * App switcher — toggles between Flatfile, Flatdeck, and Flatdrive.
 *
 * Presentational: the host (web shell) passes the current app + an onSelect
 * callback so this stays decoupled from any router.
 */

import { FileText, HardDrive, Lightbulb, Presentation } from "lucide-react";
import type { AppId } from "../types/index.ts";
import { cn } from "../lib/cn.ts";

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
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
      {APPS.map(({ id, label, icon: Icon }) => {
        const active = id === current;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
