/**
 * Collapsible sidebar container.
 *
 * When collapsed it animates to zero width so the editor/canvas takes full
 * focus (per the design philosophy). Content is app-specific and passed as
 * children by each app's dashboard/editor.
 */

import type { ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export function Sidebar({
  collapsed,
  children,
  className,
}: {
  collapsed: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "shrink-0 overflow-hidden border-r border-border bg-card/40 transition-[width] duration-200 ease-in-out",
        collapsed ? "w-0" : "w-64",
        className,
      )}
      aria-hidden={collapsed}
    >
      <div className="flex h-full w-64 flex-col">{children}</div>
    </aside>
  );
}

export function SidebarSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="px-3 py-2">
      {title && (
        <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function SidebarItem({
  icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition [&_svg]:size-4",
        active
          ? "bg-accent font-medium text-foreground [&_svg]:text-primary"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground [&_svg]:text-muted-foreground",
      )}
    >
      {icon}
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && (
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      )}
    </button>
  );
}
