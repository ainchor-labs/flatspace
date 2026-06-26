/**
 * Shared tag UI — used by every app so labels look and behave identically.
 *
 *  - TagBadge:     one colored chip (optionally removable).
 *  - TagChips:     a read-only row of chips for cards/lists (with "+N" overflow).
 *  - TagPicker:    a self-contained popover to assign/unassign + create tags on
 *                  an entity. Wires straight to the shared tag hooks.
 *  - TagFilterBar: a row of toggle chips for filtering a dashboard by tag.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Plus, Tag as TagIcon, X } from "lucide-react";
import { cn } from "../../lib/cn.ts";
import { TAG_PALETTE, type Tag, type TagEntityType, type TagWithCount } from "../../types/index.ts";
import { useCreateTag, useSetEntityTags, useTags } from "../../lib/query.ts";

/** Deterministic palette pick for a new tag (suite avoids Math.random). */
function colorForName(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length]!;
}

export function TagBadge({
  tag,
  onRemove,
  className,
}: {
  tag: Tag;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs",
        className,
      )}
    >
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${tag.name}`}
          className="-mr-0.5 rounded-full p-0.5 text-muted-foreground transition hover:text-foreground [&_svg]:size-3"
        >
          <X />
        </button>
      )}
    </span>
  );
}

export function TagChips({
  tags,
  max = 3,
  className,
}: {
  tags: Tag[];
  max?: number;
  className?: string;
}) {
  if (!tags.length) return null;
  const shown = tags.slice(0, max);
  const extra = tags.length - shown.length;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((t) => (
        <TagBadge key={t.id} tag={t} />
      ))}
      {extra > 0 && <span className="text-xs text-muted-foreground">+{extra}</span>}
    </div>
  );
}

/**
 * A popover to manage one entity's tags. Provide the entity coordinates + its
 * current tags; everything else (loading all tags, toggling, creating) is handled
 * internally via the shared hooks.
 */
export function TagPicker({
  entityType,
  entityId,
  current,
  trigger,
  align = "start",
}: {
  entityType: TagEntityType;
  entityId: number;
  current: Tag[];
  /** Custom trigger; defaults to a small tag icon button. */
  trigger?: ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const allTags = useTags();
  const createTag = useCreateTag();
  const setEntityTags = useSetEntityTags();

  const currentIds = useMemo(() => new Set(current.map((t) => t.id)), [current]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const tags = allTags.data ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  const exact = tags.find((t) => t.name.toLowerCase() === q);
  const busy = setEntityTags.isPending || createTag.isPending;

  async function setTo(ids: number[]) {
    await setEntityTags.mutateAsync({ entityType, entityId, tagIds: ids });
  }

  async function toggle(tag: Tag) {
    const ids = currentIds.has(tag.id)
      ? current.filter((t) => t.id !== tag.id).map((t) => t.id)
      : [...current.map((t) => t.id), tag.id];
    await setTo(ids);
  }

  async function createAndAdd() {
    const name = query.trim();
    if (!name) return;
    const tag = await createTag.mutateAsync({ name, color: colorForName(name) });
    await setTo([...current.map((t) => t.id), tag.id]);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Edit tags"
        aria-expanded={open}
      >
        {trigger ?? (
          <span className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5">
            <TagIcon /> Tag
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute z-50 mt-1.5 w-60 overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl animate-scale-in",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2">
            <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !exact && q) {
                  e.preventDefault();
                  void createAndAdd();
                }
              }}
              autoFocus
              placeholder="Find or create…"
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-1.5 max-h-56 overflow-y-auto">
            {filtered.map((tag) => {
              const on = currentIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void toggle(tag)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-accent disabled:opacity-60"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                  {on && <Check className="size-3.5 text-primary" />}
                </button>
              );
            })}

            {q && !exact && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void createAndAdd()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-accent disabled:opacity-60 [&_svg]:size-3.5"
              >
                <Plus className="text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  Create “<span className="font-medium">{query.trim()}</span>”
                </span>
              </button>
            )}

            {!q && tags.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No tags yet — type a name to create one.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** A row of toggle chips for filtering a list by tag. Presentational. */
export function TagFilterBar({
  tags,
  selected,
  onToggle,
  onClear,
  className,
}: {
  tags: (Tag | TagWithCount)[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onClear?: () => void;
  className?: string;
}) {
  if (!tags.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => {
        const on = selected.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.id)}
            aria-pressed={on}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
              on
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
            {tag.name}
            {"count" in tag && <span className="text-muted-foreground/70">{tag.count}</span>}
          </button>
        );
      })}
      {onClear && selected.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-full px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
