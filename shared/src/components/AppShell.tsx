/**
 * AppShell — the shared nav shell used by every app in the suite.
 *
 * Layout: a slim top nav (logo · app switcher · global search · user menu) above
 * a row of [collapsible sidebar | main content]. Flatfile and Flatdeck render
 * their dashboards/editors into `children` and pass app-specific `sidebar`.
 *
 * Router-agnostic: navigation + search + logout are delivered via callbacks so
 * this component has no dependency on the host's routing library.
 */

import { PanelLeft, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AppId, User } from "../types/index.ts";
import { cn } from "../lib/cn.ts";
import { AppSwitcher } from "./AppSwitcher.tsx";
import { Logo } from "./Logo.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { UserMenu } from "./UserMenu.tsx";

export interface AppShellProps {
  user: User;
  currentApp: AppId;
  onSwitchApp: (app: AppId) => void;
  onLogout: () => void;
  onHome?: () => void;
  onSearch?: (query: string) => void;
  /** Called when the user presses Enter in the search box (e.g. open results). */
  onSubmitSearch?: (query: string) => void;
  searchValue?: string;
  /** Admin-only: open the user-management screen (shown in the user menu). */
  onManageUsers?: () => void;
  /** Open the current user's account settings (shown in the user menu). */
  onSettings?: () => void;
  sidebar?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  user,
  currentApp,
  onSwitchApp,
  onLogout,
  onHome,
  onSearch,
  onSubmitSearch,
  searchValue,
  onManageUsers,
  onSettings,
  sidebar,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Top nav */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3">
        {sidebar && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <PanelLeft className="size-4" />
          </button>
        )}

        <button
          onClick={onHome}
          className="rounded-md px-1.5 py-1 transition hover:opacity-90"
          aria-label="Flatspace home"
        >
          <Logo />
        </button>

        <div className="mx-1 h-5 w-px bg-border" />

        <AppSwitcher current={currentApp} onSelect={onSwitchApp} />

        {/* Global search */}
        <div className="relative mx-auto hidden w-full max-w-md md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchValue ?? ""}
            onChange={(e) => onSearch?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchValue?.trim()) onSubmitSearch?.(searchValue.trim());
            }}
            placeholder="Search documents & files…  (press Enter)"
            className={cn(
              "h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <UserMenu
            user={user}
            onLogout={onLogout}
            onManageUsers={onManageUsers}
            onSettings={onSettings}
          />
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {sidebar && <Sidebar collapsed={collapsed}>{sidebar}</Sidebar>}
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
