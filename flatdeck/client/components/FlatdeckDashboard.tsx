/**
 * Flatdeck dashboard — presentation browser.
 *
 * Scaffold: lists the user's decks as 16:9 preview cards with a "New
 * presentation" action. The visual slide editor, themes, transitions, presenter
 * mode, and PDF export arrive in later Flatdeck milestones.
 */

import { useState } from "react";
import { Copy, MoreVertical, Pencil, Plus, Presentation, Tag as TagIcon, Trash2 } from "lucide-react";
import type { DocumentSummary } from "@flatspace/shared/types";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  TagChips,
  TagFilterBar,
  TagPicker,
  useDialog,
  useToast,
} from "@flatspace/shared/ui";
import { ApiRequestError, useTags } from "@flatspace/shared/lib";
import {
  useCreateDeck,
  useDecks,
  useDeleteDeck,
  useDuplicateDeck,
  useRenameDeck,
} from "../hooks/useFlatdeck.ts";

export function FlatdeckDashboard({ onOpenDeck }: { onOpenDeck: (id: number) => void }) {
  const decks = useDecks();
  const allTags = useTags();
  const createDeck = useCreateDeck();
  const renameDeck = useRenameDeck();
  const duplicateDeck = useDuplicateDeck();
  const deleteDeck = useDeleteDeck();
  const { toast } = useToast();
  const { confirm, prompt } = useDialog();
  const [filter, setFilter] = useState<Set<number>>(new Set());

  const all = (decks.data ?? []) as DocumentSummary[];
  const items =
    filter.size === 0
      ? all
      : all.filter((d) => {
          const ids = new Set(d.tags.map((t) => t.id));
          return [...filter].every((id) => ids.has(id));
        });
  const toggleFilter = (id: number) =>
    setFilter((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const errMsg = (err: unknown, fallback: string) =>
    err instanceof ApiRequestError ? err.message : fallback;

  async function handleNew() {
    const deck = await createDeck.mutateAsync({});
    onOpenDeck(deck.id);
  }

  async function handleRename(deck: DocumentSummary) {
    const title = await prompt({ title: "Rename presentation", defaultValue: deck.title, confirmText: "Rename" });
    if (!title?.trim() || title.trim() === deck.title) return;
    try {
      await renameDeck.mutateAsync({ id: deck.id, title: title.trim() });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t rename the deck."), variant: "error" });
    }
  }

  async function handleDuplicate(deck: DocumentSummary) {
    try {
      await duplicateDeck.mutateAsync(deck.id);
      toast({ message: `Duplicated “${deck.title}”.`, variant: "success" });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t duplicate the deck."), variant: "error" });
    }
  }

  async function handleDelete(deck: DocumentSummary) {
    const ok = await confirm({
      title: `Delete “${deck.title}”?`,
      message: "This permanently deletes the presentation.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDeck.mutateAsync(deck.id);
      toast({ message: `Deleted “${deck.title}”.`, variant: "success" });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t delete the deck."), variant: "error" });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Presentations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {decks.isLoading
              ? "Loading…"
              : filter.size > 0
                ? `${items.length} of ${all.length} deck${all.length === 1 ? "" : "s"}`
                : `${all.length} deck${all.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button onClick={handleNew} disabled={createDeck.isPending}>
          <Plus /> New presentation
        </Button>
      </div>

      {(allTags.data?.length ?? 0) > 0 && (
        <TagFilterBar
          tags={allTags.data!}
          selected={filter}
          onToggle={toggleFilter}
          onClear={() => setFilter(new Set())}
          className="mb-5"
        />
      )}

      {decks.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Presentation className="size-6" />
          </div>
          <h3 className="text-base font-medium">No presentations yet</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Build sleek, markdown-powered slide decks.
          </p>
          <Button className="mt-5" onClick={handleNew}>
            <Plus /> New presentation
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No presentations match the selected tag{filter.size === 1 ? "" : "s"}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((deck) => (
            <div
              key={deck.id}
              className="group relative overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
            >
              <button onClick={() => onOpenDeck(deck.id)} className="block w-full text-left">
                <div className="flex aspect-video items-center justify-center border-b border-border bg-background/60">
                  <Presentation className="size-8 text-muted-foreground/40 transition group-hover:text-primary/60" />
                </div>
                <div className="px-3 pt-2.5">
                  <div className="truncate text-sm font-medium">{deck.title}</div>
                </div>
              </button>
              <div className="flex items-center gap-2 px-3 pb-2.5 pt-1.5">
                <div className="min-w-0 flex-1">
                  <TagChips tags={deck.tags} max={2} />
                </div>
                <TagPicker
                  entityType="document"
                  entityId={deck.id}
                  current={deck.tags}
                  align="end"
                  trigger={
                    <span className="flex items-center rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100 [&_svg]:size-3.5">
                      <TagIcon />
                    </span>
                  }
                />
              </div>
              <Menu className="absolute right-1.5 top-1.5 opacity-0 transition group-hover:opacity-100">
                <MenuTrigger>
                  <span className="flex size-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground [&_svg]:size-4">
                    <MoreVertical />
                  </span>
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuItem icon={<Pencil />} onSelect={() => handleRename(deck)}>
                    Rename
                  </MenuItem>
                  <MenuItem icon={<Copy />} onSelect={() => handleDuplicate(deck)}>
                    Duplicate
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 />} destructive onSelect={() => handleDelete(deck)}>
                    Delete
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
