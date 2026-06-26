/**
 * Derives shared AppShell props from the router + auth state, so each page can
 * drop into <AppShell {...shell}> with consistent nav, app-switching, search,
 * and logout behaviour.
 */

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLogout } from "@flatspace/shared/lib";
import type { AppId, User } from "@flatspace/shared/types";

export function useShell(user: User) {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useLogout();
  const [search, setSearch] = useState("");

  const currentApp: AppId = location.pathname.startsWith("/flatdeck")
    ? "flatdeck"
    : location.pathname.startsWith("/flatdrive")
      ? "flatdrive"
      : location.pathname.startsWith("/flatthoughts")
        ? "flatthoughts"
        : "flatfile";

  return {
    search,
    setSearch,
    shell: {
      user,
      currentApp,
      onSwitchApp: (app: AppId) => navigate(`/${app}`),
      onHome: () => navigate("/flatdrive"),
      onSearch: setSearch,
      onSubmitSearch: (q: string) => navigate(`/search?q=${encodeURIComponent(q)}`),
      searchValue: search,
      onManageUsers: () => navigate("/admin/users"),
      onSettings: () => navigate("/settings"),
      onLogout: async () => {
        await logout.mutateAsync();
        navigate("/");
      },
    },
  };
}
