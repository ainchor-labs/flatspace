/**
 * User avatar + dropdown menu (top-right of the shell).
 * Shows the username, role, and a logout action.
 */

import { ChevronsUpDown, LogOut, Settings, Tag, User as UserIcon, Users } from "lucide-react";
import type { User } from "../types/index.ts";
import { Avatar } from "./Avatar.tsx";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "./ui/menu.tsx";

export function UserMenu({
  user,
  onLogout,
  onSettings,
  onManageUsers,
  onManageTags,
  variant = "avatar",
}: {
  user: User;
  onLogout: () => void;
  onSettings?: () => void;
  /** Admin-only: open the user-management screen. */
  onManageUsers?: () => void;
  /** Open the tag-management screen. */
  onManageTags?: () => void;
  /**
   * "avatar" — a bare avatar button (compact, e.g. a top bar).
   * "bar" — a full-width row (avatar + name + chevron) for the sidebar footer.
   */
  variant?: "avatar" | "bar";
}) {
  return (
    <Menu>
      <MenuTrigger>
        {variant === "bar" ? (
          <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar name={user.username} color={user.avatarColor} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.username}</div>
              <div className="text-xs capitalize text-muted-foreground">{user.role}</div>
            </div>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <button className="rounded-full ring-offset-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar name={user.username} color={user.avatarColor} />
          </button>
        )}
      </MenuTrigger>
      <MenuContent
        align={variant === "bar" ? "start" : "end"}
        className={variant === "bar" ? "bottom-full mb-2 mt-0 w-56" : undefined}
      >
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <Avatar name={user.username} color={user.avatarColor} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user.username}</div>
            <div className="text-xs capitalize text-muted-foreground">{user.role}</div>
          </div>
        </div>
        <MenuSeparator />
        <MenuItem icon={<UserIcon />}>Profile</MenuItem>
        <MenuItem icon={<Settings />} onSelect={onSettings}>
          Settings
        </MenuItem>
        {onManageTags && (
          <MenuItem icon={<Tag />} onSelect={onManageTags}>
            Manage tags
          </MenuItem>
        )}
        {user.role === "admin" && onManageUsers && (
          <MenuItem icon={<Users />} onSelect={onManageUsers}>
            Manage users
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem icon={<LogOut />} destructive onSelect={onLogout}>
          Log out
        </MenuItem>
        <MenuLabel>Flatspace Suite v0.1</MenuLabel>
      </MenuContent>
    </Menu>
  );
}
