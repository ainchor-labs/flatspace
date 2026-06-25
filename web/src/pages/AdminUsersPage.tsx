/**
 * Admin user-management page (/admin/users).
 *
 * Admin-only: lists all accounts and lets an admin create users, change roles,
 * reset passwords, and delete accounts (which also removes that user's data).
 * Non-admins are redirected away.
 */

import { type FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import {
  AppShell,
  Avatar,
  Button,
  Input,
  useDialog,
  useToast,
} from "@flatspace/shared/ui";
import type { User, UserRole } from "@flatspace/shared/types";
import {
  ApiRequestError,
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from "@flatspace/shared/lib";
import { useShell } from "../hooks/useShell.ts";

const selectClass =
  "h-9 rounded-md border border-border bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AdminUsersPage({ user }: { user: User }) {
  const { shell } = useShell(user);

  if (user.role !== "admin") return <Navigate to="/flatdrive" replace />;

  return (
    <AppShell {...shell}>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create accounts and manage roles for everyone on this server.
          </p>
        </div>
        <CreateUserForm />
        <UserList me={user} />
      </div>
    </AppShell>
  );
}

function CreateUserForm() {
  const create = useCreateUser();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("member");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const name = username.trim();
    try {
      await create.mutateAsync({ username: name, password, role });
      setUsername("");
      setPassword("");
      setRole("member");
      toast({ message: `Created account for ${name}.`, variant: "success" });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t create the user.");
    }
  }

  return (
    <form onSubmit={submit} className="mb-8 rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium">Add a user</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1 space-y-1">
          <label htmlFor="new-username" className="text-xs text-muted-foreground">
            Username
          </label>
          <Input
            id="new-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="newuser"
            autoComplete="off"
            required
          />
        </div>
        <div className="min-w-40 flex-1 space-y-1">
          <label htmlFor="new-password" className="text-xs text-muted-foreground">
            Password
          </label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-role" className="text-xs text-muted-foreground">
            Role
          </label>
          <select
            id="new-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={`${selectClass} block`}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <Button type="submit" disabled={create.isPending}>
          <UserPlus /> Add user
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </form>
  );
}

function UserList({ me }: { me: User }) {
  const usersQuery = useUsers();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const { toast } = useToast();
  const { confirm, prompt } = useDialog();

  if (usersQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading users…</p>;
  }
  if (usersQuery.isError || !usersQuery.data) {
    return <p className="text-sm text-destructive">Couldn’t load users.</p>;
  }

  function errorMessage(err: unknown, fallback: string): string {
    return err instanceof ApiRequestError ? err.message : fallback;
  }

  async function changeRole(u: User, role: UserRole) {
    if (role === u.role) return;
    try {
      await update.mutateAsync({ id: u.id, role });
      toast({ message: `${u.username} is now ${role === "admin" ? "an admin" : "a member"}.`, variant: "success" });
    } catch (err) {
      toast({ message: errorMessage(err, "Couldn’t change the role."), variant: "error" });
    }
  }

  async function resetPassword(u: User) {
    const password = await prompt({
      title: `Reset password for ${u.username}`,
      message: "Enter a new password (at least 8 characters).",
      placeholder: "New password",
      confirmText: "Set password",
    });
    if (password == null) return;
    try {
      await update.mutateAsync({ id: u.id, password });
      toast({ message: `Password updated for ${u.username}.`, variant: "success" });
    } catch (err) {
      toast({ message: errorMessage(err, "Couldn’t reset the password."), variant: "error" });
    }
  }

  async function deleteUser(u: User) {
    const ok = await confirm({
      title: `Delete ${u.username}?`,
      message: `This permanently removes ${u.username} and ALL of their files and documents. This can't be undone.`,
      confirmText: "Delete user",
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(u.id);
      toast({ message: `Deleted ${u.username}.`, variant: "success" });
    } catch (err) {
      toast({ message: errorMessage(err, "Couldn’t delete the user."), variant: "error" });
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {usersQuery.data.map((u, i) => (
        <div
          key={u.id}
          className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
        >
          <Avatar name={u.username} color={u.avatarColor} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 truncate text-sm font-medium">
              {u.username}
              {u.id === me.id && <span className="text-xs text-muted-foreground">(you)</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              Joined {new Date(u.createdAt).toLocaleDateString()}
            </div>
          </div>

          <select
            aria-label={`Role for ${u.username}`}
            value={u.role}
            onChange={(e) => changeRole(u, e.target.value as UserRole)}
            disabled={update.isPending}
            className={selectClass}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>

          <Button variant="outline" size="sm" onClick={() => resetPassword(u)}>
            <ShieldCheck /> Reset password
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => deleteUser(u)}
            disabled={u.id === me.id}
            title={u.id === me.id ? "You can't delete your own account" : "Delete user"}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </div>
  );
}
