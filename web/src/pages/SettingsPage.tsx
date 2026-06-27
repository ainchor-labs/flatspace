/**
 * Account settings (/settings) — self-service profile.
 *
 * Lets any signed-in user change their own avatar color and password. (Admins
 * manage *other* accounts from /admin/users.)
 */

import { type FormEvent, useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { AppShell, Avatar, Button, Input, useDialog, useToast } from "@flatspace/shared/ui";
import {
  ApiRequestError,
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  useUpdateProfile,
} from "@flatspace/shared/lib";
import {
  AVATAR_PALETTE,
  type ApiKey,
  type ApiKeyWithSecret,
  type User,
} from "@flatspace/shared/types";
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
        <ApiKeysSection />
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
    <section className="mb-6 rounded-xl border border-border bg-card p-5">
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

/**
 * Personal access tokens for the programmatic REST API (/api/v1). The full
 * secret is shown exactly once, right after creation; afterwards only the prefix
 * is ever displayed, so each key can be identified and revoked.
 */
function ApiKeysSection() {
  const { data: keys, isLoading } = useApiKeys();
  const create = useCreateApiKey();
  const remove = useDeleteApiKey();
  const { prompt, confirm } = useDialog();
  const { toast } = useToast();
  // The just-created key, held in memory only until the user dismisses it.
  const [fresh, setFresh] = useState<ApiKeyWithSecret | null>(null);

  async function handleCreate() {
    const name = await prompt({
      title: "New API key",
      message: "Give the key a name so you can recognise it later.",
      placeholder: "e.g. CLI on my laptop",
      confirmText: "Create",
    });
    if (name === null) return;
    try {
      const created = await create.mutateAsync({ name: name.trim() || undefined });
      setFresh(created);
    } catch (err) {
      toast({
        message: err instanceof ApiRequestError ? err.message : "Couldn’t create the key.",
        variant: "error",
      });
    }
  }

  async function handleDelete(key: ApiKey) {
    const ok = await confirm({
      title: `Revoke “${key.name}”?`,
      message: "Any client using this key will stop working immediately. This can’t be undone.",
      confirmText: "Revoke",
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(key.id);
      if (fresh?.id === key.id) setFresh(null);
      toast({ message: `Revoked “${key.name}”.`, variant: "success" });
    } catch (err) {
      toast({
        message: err instanceof ApiRequestError ? err.message : "Couldn’t revoke the key.",
        variant: "error",
      });
    }
  }

  async function copySecret(value: string) {
    const ok = await copyToClipboard(value);
    toast(
      ok
        ? { message: "Key copied to clipboard.", variant: "success" }
        : { message: "Couldn’t copy — select and copy it manually.", variant: "error" },
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">API keys</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Authenticate to the REST API at{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/api/v1</code> with{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              Authorization: Bearer &lt;key&gt;
            </code>
            .
          </p>
        </div>
        <Button size="sm" onClick={handleCreate} disabled={create.isPending}>
          <Plus className="size-4" />
          New key
        </Button>
      </div>

      {/* One-time secret reveal for a freshly created key. */}
      {fresh && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <div className="text-xs font-medium">Copy your new key now</div>
          <p className="mt-1 text-xs text-muted-foreground">
            This is the only time the full key is shown. Store it somewhere safe.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-xs">
              {fresh.key}
            </code>
            <Button size="sm" variant="secondary" onClick={() => copySecret(fresh.key)}>
              <Copy className="size-4" />
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFresh(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !keys || keys.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
            <KeyRound className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{key.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <code className="font-mono">{key.prefix}…</code>
                    <span aria-hidden>·</span>
                    <span>Created {formatDate(key.createdAt)}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {key.lastUsedAt ? `Last used ${formatDate(key.lastUsedAt)}` : "Never used"}
                    </span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Revoke ${key.name}`}
                  onClick={() => handleDelete(key)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Format a SQLite UTC timestamp ("YYYY-MM-DD HH:MM:SS") as a short local date. */
function formatDate(value: string): string {
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Copy text to the clipboard, falling back to execCommand on non-secure (LAN HTTP) origins. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path below
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
