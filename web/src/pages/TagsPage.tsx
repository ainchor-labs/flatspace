/**
 * Tags manager (/tags) — create, rename, recolor, and delete the shared per-user
 * tag vocabulary. Usage counts come from the server; deleting a tag removes it
 * from every item it labels.
 */

import { useState } from "react";
import { Check, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import {
  AppShell,
  Button,
  Menu,
  MenuContent,
  MenuTrigger,
  useDialog,
  useToast,
} from "@flatspace/shared/ui";
import {
  ApiRequestError,
  useCreateTag,
  useDeleteTag,
  useTags,
  useUpdateTag,
} from "@flatspace/shared/lib";
import { TAG_PALETTE, type TagWithCount, type User } from "@flatspace/shared/types";
import { useShell } from "../hooks/useShell.ts";

function Swatches({ value, onPick }: { value?: string; onPick: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 p-1">
      {TAG_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onPick(color)}
          aria-label={color}
          className="flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-popover transition hover:scale-110"
          style={{ backgroundColor: color }}
        >
          {value === color && <Check className="size-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}

export function TagsPage({ user }: { user: User }) {
  const { shell } = useShell(user);
  const tags = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const { toast } = useToast();
  const { confirm, prompt } = useDialog();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_PALETTE[0]);

  const items = tags.data ?? [];
  const errMsg = (err: unknown, fallback: string) =>
    err instanceof ApiRequestError ? err.message : fallback;

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createTag.mutateAsync({ name: trimmed, color });
      setName("");
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t create the tag."), variant: "error" });
    }
  }

  async function handleRename(tag: TagWithCount) {
    const next = await prompt({ title: "Rename tag", defaultValue: tag.name, confirmText: "Rename" });
    if (next == null || !next.trim() || next.trim() === tag.name) return;
    try {
      await updateTag.mutateAsync({ id: tag.id, name: next.trim() });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t rename the tag."), variant: "error" });
    }
  }

  async function handleRecolor(tag: TagWithCount, nextColor: string) {
    try {
      await updateTag.mutateAsync({ id: tag.id, color: nextColor });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t recolor the tag."), variant: "error" });
    }
  }

  async function handleDelete(tag: TagWithCount) {
    const ok = await confirm({
      title: `Delete “${tag.name}”?`,
      message:
        tag.count > 0
          ? `This removes the tag from ${tag.count} item${tag.count === 1 ? "" : "s"}.`
          : "This permanently deletes the tag.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTag.mutateAsync(tag.id);
      toast({ message: `Deleted “${tag.name}”.`, variant: "success" });
    } catch (err) {
      toast({ message: errMsg(err, "Couldn’t delete the tag."), variant: "error" });
    }
  }

  return (
    <AppShell {...shell}>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tags.isLoading ? "Loading…" : `${items.length} tag${items.length === 1 ? "" : "s"}`} — used
          across documents, files, and thoughts.
        </p>

        {/* Create */}
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
          <Menu>
            <MenuTrigger>
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: color }}
                aria-label="Pick color"
              />
            </MenuTrigger>
            <MenuContent align="start">
              <Swatches value={color} onPick={setColor} />
            </MenuContent>
          </Menu>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="New tag name…"
            maxLength={40}
            className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button onClick={handleCreate} disabled={!name.trim() || createTag.isPending}>
            <Plus /> Create
          </Button>
        </div>

        {/* List */}
        <div className="mt-6 overflow-hidden rounded-xl border border-border">
          {tags.isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <TagIcon className="size-5" />
              </div>
              <p className="text-sm font-medium">No tags yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create one above, or add tags from any item’s tag button.
              </p>
            </div>
          ) : (
            items.map((tag, i) => (
              <div
                key={tag.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <Menu>
                  <MenuTrigger>
                    <span
                      className="size-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10 transition hover:scale-110"
                      style={{ backgroundColor: tag.color }}
                      aria-label="Change color"
                    />
                  </MenuTrigger>
                  <MenuContent align="start">
                    <Swatches value={tag.color} onPick={(c) => handleRecolor(tag, c)} />
                  </MenuContent>
                </Menu>
                <button
                  onClick={() => handleRename(tag)}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                >
                  {tag.name}
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {tag.count} item{tag.count === 1 ? "" : "s"}
                </span>
                <button
                  onClick={() => handleDelete(tag)}
                  aria-label={`Delete ${tag.name}`}
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive [&_svg]:size-4"
                >
                  <Trash2 />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
