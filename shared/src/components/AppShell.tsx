/**
 * AppShell — the shared chrome used by every app in the suite.
 *
 * Layout: a left sidebar beside the main content. The sidebar stacks, top to
 * bottom: the Flatspace logo, the app switcher, global search, the app-specific
 * navigation (`sidebar`), and the account menu pinned to the bottom.
 *
 * Responsive: on desktop (md+) the sidebar is persistent — the suite's only
 * chrome. On mobile it collapses into an off-canvas drawer toggled by a
 * hamburger in a slim top bar, with a tap-to-dismiss backdrop; navigating or
 * picking a sidebar item closes it so the content gets the full screen.
 *
 * Router-agnostic: navigation + search + logout are delivered via callbacks so
 * this component has no dependency on the host's routing library.
 */

import { Menu, Search, X } from "lucide-react";
import { useState, type ReactNode } from "react";
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
  // Mobile drawer state — ignored on desktop, where the sidebar is always shown.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);
  // Wrap a callback so it also dismisses the mobile drawer (no-op on desktop).
  const andClose =
    <A extends unknown[]>(fn?: (...args: A) => void) =>
    (...args: A) => {
      closeDrawer();
      fn?.(...args);
    };

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Mobile backdrop — tap to dismiss the drawer. */}
      {drawerOpen && (
        <button
          aria-label="Close menu"
          onClick={closeDrawer}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      {/* Sidebar: off-canvas drawer on mobile, persistent column on desktop. */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-card",
          "transition-transform duration-200 ease-in-out",
          "md:static md:z-auto md:translate-x-0 md:bg-card/40",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col gap-2 px-3 pb-2 pt-3">
          <div className="flex items-center justify-between">
            <button
              onClick={andClose(onHome)}
              className="self-start rounded-md px-1 py-1 transition hover:opacity-90"
              aria-label="Flatspace home"
            >
              <Logo />
            </button>
            {/* Close button (mobile only). */}
            <button
              onClick={closeDrawer}
              aria-label="Close menu"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden [&_svg]:size-5"
            >
              <X />
            </button>
          </div>

          <AppSwitcher current={currentApp} onSelect={andClose(onSwitchApp)} />

          {/* Global search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchValue ?? ""}
              onChange={(e) => onSearch?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchValue?.trim()) {
                  closeDrawer();
                  onSubmitSearch?.(searchValue.trim());
                }
              }}
              placeholder="Search…"
              className={cn(
                "h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-sm",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            />
          </div>
        </div>

        {/* App-specific navigation (scrolls independently). A tap on any nav
            item dismisses the drawer so the content takes the full screen. */}
        <div className="min-h-0 flex-1 overflow-y-auto" onClick={closeDrawer}>
          {sidebar}
        </div>

        {/* Account, pinned to the bottom. */}
        <div className="border-t border-border p-2">
          <UserMenu
            user={user}
            variant="bar"
            onLogout={onLogout}
            onManageUsers={andClose(onManageUsers)}
            onManageTags={andClose(onManageTags)}
            onSettings={andClose(onSettings)}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Slim top bar (mobile only) — hosts the hamburger since the sidebar
            is hidden off-canvas. */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-5"
          >
            <Menu />
          </button>
          <button onClick={onHome} aria-label="Flatspace home" className="transition hover:opacity-90">
            <Logo />
          </button>
        </div>

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
