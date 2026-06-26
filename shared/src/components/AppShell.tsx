/**
 * AppShell — the shared chrome used by every app in the suite.
 *
 * Layout: a single, always-visible left sidebar beside the main content. The
 * sidebar stacks, top to bottom: the Flatspace logo, the app switcher, global
 * search, the app-specific navigation (`sidebar`), and the account menu pinned
 * to the bottom. There is no top bar — the sidebar is the only persistent chrome.
 *
 * Router-agnostic: navigation + search + logout are delivered via callbacks so
 * this component has no dependency on the host's routing library.
 */

import { Search } from "lucide-react";
import { type ReactNode } from "react";
import type { AppId, User } from "../types/index.ts";
import { cn } from "../lib/cn.ts";
import { AppSwitcher } from "./AppSwitcher.tsx";
import { Logo } from "./Logo.tsx";
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
  /** Admin-only: open the user-management screen (shown in the account menu). */
  onManageUsers?: () => void;
  /** Open the tag-management screen (shown in the account menu). */
  onManageTags?: () => void;
  /** Open the current user's account settings (shown in the account menu). */
  onSettings?: () => void;
  /** App-specific navigation rendered in the middle of the sidebar. */
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
  onManageTags,
  onSettings,
  sidebar,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Persistent sidebar — the suite's only chrome. */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="flex flex-col gap-2 px-3 pb-2 pt-3">
          <button
            onClick={onHome}
            className="self-start rounded-md px-1 py-1 transition hover:opacity-90"
            aria-label="Flatspace home"
          >
            <Logo />
          </button>

          <AppSwitcher current={currentApp} onSelect={onSwitchApp} />

          {/* Global search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchValue ?? ""}
              onChange={(e) => onSearch?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchValue?.trim()) onSubmitSearch?.(searchValue.trim());
              }}
              placeholder="Search…"
              className={cn(
                "h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            />
          </div>
        </div>

        {/* App-specific navigation (scrolls independently). */}
        <div className="min-h-0 flex-1 overflow-y-auto">{sidebar}</div>

        {/* Account, pinned to the bottom. */}
        <div className="border-t border-border p-2">
          <UserMenu
            user={user}
            variant="bar"
            onLogout={onLogout}
            onManageUsers={onManageUsers}
            onManageTags={onManageTags}
            onSettings={onSettings}
          />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
