/**
 * Auth screen — shared login form (plus first-run admin setup).
 *
 * A single centered card on the near-black canvas with the Flatspace mark.
 * Registration is closed once the first account exists: on a fresh install this
 * shows a "Create your admin account" form; afterwards it's sign-in only, and
 * further accounts are created by an admin. Uses the shared auth hooks so all
 * server state flows through React Query.
 */

import { type FormEvent, useState } from "react";
import { ApiRequestError } from "../lib/api.ts";
import { useLogin, useRegister, useSetupStatus } from "../lib/query.ts";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { Logo } from "./Logo.tsx";

export function AuthScreen({ onSuccess }: { onSuccess?: () => void }) {
  const setup = useSetupStatus();
  const needsSetup = setup.data?.needsSetup ?? false;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useLogin();
  const register = useRegister();
  const pending = login.isPending || register.isPending;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const action = needsSetup ? register : login;
    try {
      await action.mutateAsync({ username: username.trim(), password });
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* soft indigo glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo showWordmark={false} className="scale-150" />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">
              {needsSetup ? "Create your admin account" : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {needsSetup
                ? "Set up your self-hosted Flatspace Suite"
                : "Sign in to your Flatspace Suite"}
            </p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
        >
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourname"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete={needsSetup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            {needsSetup && (
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Please wait…" : needsSetup ? "Create account" : "Sign in"}
          </Button>
        </form>

        {!needsSetup && (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Need an account? Ask an administrator to create one for you.
          </p>
        )}
      </div>
    </div>
  );
}
