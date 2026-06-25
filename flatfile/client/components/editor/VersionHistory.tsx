/**
 * Version history slide-over.
 *
 * Lists the document's auto-saved snapshots (newest first), lets you preview a
 * snapshot's text, and restore one. Restoring is reversible — the server first
 * snapshots the current state as a "Before restore" version.
 */

import { useState } from "react";
import { History, RotateCcw, X } from "lucide-react";
import type { VersionSummary } from "@flatspace/shared/types";
import { Button } from "@flatspace/shared/ui";
import { cn } from "@flatspace/shared/lib";
import { relativeTime } from "../../lib/time.ts";
import { fetchVersion, useRestoreVersion, useVersions } from "../../hooks/useVersions.ts";

/** Extract readable plain text from a stored snapshot (TipTap JSON or markdown). */
function snapshotToText(content: string): string {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("{")) return content; // legacy markdown string
  try {
    const json = JSON.parse(content) as unknown;
    const out: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const n = node as { text?: string; content?: unknown[] };
      if (typeof n.text === "string") out.push(n.text);
      if (Array.isArray(n.content)) n.content.forEach(walk);
    };
    walk(json);
    return out.join(" ");
  } catch {
    return content;
  }
}

export function VersionHistory({
  docId,
  onClose,
  onRestored,
}: {
  docId: number;
  onClose: () => void;
  onRestored: (content: string) => void;
}) {
  const { data: list, isLoading } = useVersions(docId);
  const restore = useRestoreVersion(docId);
  const [selected, setSelected] = useState<VersionSummary | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [confirming, setConfirming] = useState(false);

  const select = async (v: VersionSummary) => {
    setSelected(v);
    setConfirming(false);
    setPreview("");
    try {
      const full = await fetchVersion(docId, v.id);
      setPreview(snapshotToText(full.contentSnapshot).slice(0, 2000));
    } catch {
      setPreview("(couldn’t load preview)");
    }
  };

  const doRestore = () => {
    if (!selected) return;
    restore.mutate(selected.id, {
      onSuccess: (doc) => {
        onRestored(doc.content);
        onClose();
      },
    });
  };

  return (
    <div className="fixed inset-0 z-[150] flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-[26rem] max-w-[90vw] flex-col border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="flex items-center gap-2 text-sm font-medium [&_svg]:size-4 [&_svg]:text-muted-foreground">
            <History /> Version history
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-4"
          >
            <X />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading history…</p>
          ) : !list || list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No saved versions yet. Snapshots are captured automatically as you edit.
            </p>
          ) : (
            <ul className="p-2">
              {list.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => select(v)}
                    className={cn(
                      "w-full rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-accent",
                      selected?.id === v.id && "bg-accent",
                    )}
                  >
                    <span className="block font-medium">{relativeTime(v.createdAt)}</span>
                    {v.label && (
                      <span className="mt-0.5 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                        {v.label}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <div className="shrink-0 border-t border-border p-3">
            <p className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
              {preview || "Loading preview…"}
            </p>
            {confirming ? (
              <div className="flex items-center gap-2">
                <Button onClick={doRestore} disabled={restore.isPending}>
                  <RotateCcw /> {restore.isPending ? "Restoring…" : "Confirm restore"}
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)} disabled={restore.isPending}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                <RotateCcw /> Restore this version
              </Button>
            )}
            {restore.isError && (
              <p className="mt-2 text-xs text-destructive">Restore failed. Please try again.</p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
