/**
 * FlatthoughtsDashboard (screen 1) — the wall of thoughts.
 *
 * A masonry-ish grid of note cards (derived title + snippet + date) with a
 * per-card menu (delete). The header offers "New thought" (→ compose screen) and
 * "Triage" (→ the Tinder-style swipe deck). Clicking a card opens it for editing.
 */

import { Layers, MoreVertical, Plus, StickyNote, Trash2 } from "lucide-react";
import type { Thought } from "@flatspace/shared/types";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  useDialog,
  useToast,
} from "@flatspace/shared/ui";
import { ApiRequestError } from "@flatspace/shared/lib";
import { useDeleteThought, useThoughts } from "../hooks/useFlatthoughts.ts";
import { shortDate, thoughtSnippet, thoughtTitle } from "../lib/thought.ts";

export function FlatthoughtsDashboard({
  onOpenThought,
  onNew,
  onTriage,
}: {
  onOpenThought: (id: number) => void;
  onNew: () => void;
  onTriage: () => void;
}) {
  const thoughts = useThoughts();
  const deleteThought = useDeleteThought();
  const { toast } = useToast();
  const { confirm } = useDialog();
  const items = thoughts.data ?? [];
  const errMsg = (err: unknown, fallback: string) =>
    err instanceof ApiRequestError ? err.message : fallback;

  async function handleDelete(thought: Thought) {
    const label = thoughtTitle(thought);
    const ok = await confirm({
      title: `Delete “${label}”?`,
      message: "This permanently deletes the thought.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteThought.mutateAsync(thought.id);
      toast({ message: `Deleted “${label}”.`, variant: "success" });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t delete the thought."), variant: "error" });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Thoughts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {thoughts.isLoading
              ? "Loading…"
              : `${items.length} thought${items.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onTriage} disabled={items.length === 0}>
            <Layers /> Triage
          </Button>
          <Button onClick={onNew}>
            <Plus /> New thought
          </Button>
        </div>
      </div>

      {thoughts.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <StickyNote className="size-6" />
          </div>
          <h3 className="text-base font-medium">No thoughts yet</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Capture quick, markdown-powered notes — then triage them later.
          </p>
          <Button className="mt-5" onClick={onNew}>
            <Plus /> New thought
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((thought) => {
            const snippet = thoughtSnippet(thought);
            return (
              <div
                key={thought.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
              >
                <button
                  onClick={() => onOpenThought(thought.id)}
                  className="flex min-h-40 flex-1 flex-col p-4 text-left"
                >
                  <div className="line-clamp-2 pr-6 text-sm font-semibold">
                    {thoughtTitle(thought)}
                  </div>
                  {snippet && (
                    <p className="mt-1.5 line-clamp-4 flex-1 text-sm text-muted-foreground">
                      {snippet}
                    </p>
                  )}
                  <div className="mt-3 text-xs text-muted-foreground/70">
                    {shortDate(thought.updatedAt)}
                  </div>
                </button>
                <Menu className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100">
                  <MenuTrigger>
                    <span className="flex size-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground [&_svg]:size-4">
                      <MoreVertical />
                    </span>
                  </MenuTrigger>
                  <MenuContent align="end">
                    <MenuItem icon={<Trash2 />} destructive onSelect={() => handleDelete(thought)}>
                      Delete
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
