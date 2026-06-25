/**
 * Account settings (/settings) — self-service profile.
 *
 * Lets any signed-in user change their own avatar color and password. (Admins
 * manage *other* accounts from /admin/users.)
 */

import { type FormEvent, useState } from "react";
import { Check } from "lucide-react";
import { AppShell, Avatar, Button, Input, useToast } from "@flatspace/shared/ui";
import { ApiRequestError, useUpdateProfile } from "@flatspace/shared/lib";
import { AVATAR_PALETTE, type User } from "@flatspace/shared/types";
import { cn } from "@flatspace/shared/lib";
import { useShell } from "../hooks/useShell.ts";

export function SettingsPage({ user }: { user: User }) {
  const { shell } = useShell(user);
  return (
    <AppShell {...shell}>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your account.</p>
        </div>
        <AvatarSection user={user} />
        <PasswordSection />
      </div>
    </AppShell>
  );
}

function AvatarSection({ user }: { user: User }) {
  const update = useUpdateProfile();
  const { toast } = useToast();

  async function pick(color: string) {
    if (color === user.avatarColor) return;
    try {
      await update.mutateAsync({ avatarColor: color });
      toast({ message: "Avatar color updated.", variant: "success" });
    } catch (err) {
      toast({
        message: err instanceof ApiRequestError ? err.message : "Couldn’t update the color.",
        variant: "error",
      });
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium">Profile</h2>
      <div className="mt-4 flex items-center gap-4">
        <Avatar name={user.username} color={user.avatarColor} />
        <div>
          <div className="text-sm font-medium">{user.username}</div>
          <div className="text-xs capitalize text-muted-foreground">{user.role}</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-2 text-xs text-muted-foreground">Avatar color</div>
        <div className="flex flex-wrap gap-2">
          {AVATAR_PALETTE.map((color) => (
            <button
              key={color}
              onClick={() => pick(color)}
              disabled={update.isPending}
              aria-label={`Use ${color}`}
              className={cn(
                "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition",
                color === user.avatarColor ? "ring-2 ring-foreground" : "hover:scale-110",
              )}
              style={{ backgroundColor: color }}
            >
              {color === user.avatarColor && <Check className="size-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function PasswordSection() {
  const update = useUpdateProfile();
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("New passwords don’t match.");
    try {
      await update.mutateAsync({ currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast({ message: "Password changed.", variant: "success" });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t change the password.");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium">Change password</h2>
      <form onSubmit={submit} className="mt-4 max-w-sm space-y-3">
        <div className="space-y-1">
          <label htmlFor="cur-pw" className="text-xs text-muted-foreground">
            Current password
          </label>
          <Input
            id="cur-pw"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-pw" className="text-xs text-muted-foreground">
            New password
          </label>
          <Input
            id="new-pw"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="At least 8 characters"
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="confirm-pw" className="text-xs text-muted-foreground">
            Confirm new password
          </label>
          <Input
            id="confirm-pw"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={update.isPending}>
          Update password
        </Button>
      </form>
    </section>
  );
}
