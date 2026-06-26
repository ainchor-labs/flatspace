/**
 * TriageMode (screen 4) — the "Tinder for notes" swipe deck.
 *
 * Thoughts are presented one at a time, least-recently-reviewed first. Swipe (or
 * drag, or use ← / →) RIGHT to KEEP (stamps reviewed_at so it sinks in the deck)
 * or LEFT to TOSS (deletes it, with a brief Undo). Escape exits.
 */

import "./flatthoughts.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import type { Thought } from "@flatspace/shared/types";
import {
  useCreateThought,
  useDeleteThought,
  useReviewQueue,
  useReviewThought,
} from "../hooks/useFlatthoughts.ts";
import { renderThoughtHtml, thoughtTitle } from "../lib/thought.ts";

type Dir = "left" | "right";
const SWIPE_THRESHOLD = 120;
const ANIM_MS = 320;

export function TriageMode({ onClose }: { onClose: () => void }) {
  const queue = useReviewQueue();
  const reviewThought = useReviewThought();
  const deleteThought = useDeleteThought();
  const createThought = useCreateThought();

  const deck = queue.data ?? [];
  const [index, setIndex] = useState(0);
  const [anim, setAnim] = useState<Dir | null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [undo, setUndo] = useState<{ title: string; content: string } | null>(null);
  const startX = useRef(0);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current: Thought | undefined = deck[index];
  const kept = useRef(0);
  const tossed = useRef(0);

  const decide = useCallback(
    (dir: Dir) => {
      if (!current || anim) return;
      setAnim(dir);
      setDragging(false);
      if (dir === "right") {
        kept.current += 1;
        reviewThought.mutate(current.id);
      } else {
        tossed.current += 1;
        setUndo({ title: current.title, content: current.content });
        deleteThought.mutate(current.id);
        if (undoTimer.current) clearTimeout(undoTimer.current);
        undoTimer.current = setTimeout(() => setUndo(null), 6000);
      }
      setTimeout(() => {
        setAnim(null);
        setDx(0);
        setIndex((i) => i + 1);
      }, ANIM_MS);
    },
    [current, anim, reviewThought, deleteThought],
  );

  const doUndo = useCallback(() => {
    if (!undo) return;
    createThought.mutate({ title: undo.title, content: undo.content });
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, [undo, createThought]);

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") decide("left");
      else if (e.key === "ArrowRight") decide("right");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [decide, onClose]);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  // Pointer drag on the top card.
  const onPointerDown = (e: React.PointerEvent) => {
    if (anim) return;
    setDragging(true);
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDx(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (!dragging) return;
    if (dx > SWIPE_THRESHOLD) decide("right");
    else if (dx < -SWIPE_THRESHOLD) decide("left");
    else {
      setDragging(false);
      setDx(0);
    }
  };

  const html = useMemo(() => (current ? renderThoughtHtml(current.content) : ""), [current]);

  const done = !queue.isLoading && index >= deck.length;
  const remaining = Math.max(0, deck.length - index);

  // Tilt + hint opacity from the live drag offset.
  const cardStyle =
    anim || !dragging
      ? undefined
      : { transform: `translateX(${dx}px) rotate(${dx / 22}deg)`, transition: "none" as const };
  const keepHint = Math.max(0, Math.min(1, dx / SWIPE_THRESHOLD));
  const tossHint = Math.max(0, Math.min(1, -dx / SWIPE_THRESHOLD));

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-background/95 backdrop-blur">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="text-sm font-medium">
          Triage
          {!queue.isLoading && deck.length > 0 && !done && (
            <span className="ml-2 text-muted-foreground">{remaining} left</span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Exit triage"
          className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-4"
        >
          <X />
        </button>
      </header>

      {/* Card stage */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-4">
        {queue.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : done ? (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <Check className="size-7" />
            </div>
            <h3 className="text-lg font-medium">All caught up</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Kept {kept.current} · tossed {tossed.current}.
            </p>
            <button
              onClick={onClose}
              className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        ) : current ? (
          <>
            <div className="relative w-full max-w-md flex-1">
              {/* Peek of the next card */}
              {deck[index + 1] && (
                <div className="absolute inset-x-3 top-3 bottom-0 -z-10 scale-[0.97] rounded-2xl border border-border bg-card/60" />
              )}
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={cardStyle}
                className={`ft-card-in absolute inset-0 flex touch-none select-none flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ${
                  anim === "right" ? "ft-leaving-right" : anim === "left" ? "ft-leaving-left" : ""
                } ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
              >
                {/* Keep / Toss overlays */}
                <div
                  className="pointer-events-none absolute left-4 top-4 rounded-md border-2 border-emerald-500 px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-emerald-500"
                  style={{ opacity: keepHint }}
                >
                  Keep
                </div>
                <div
                  className="pointer-events-none absolute right-4 top-4 rounded-md border-2 border-destructive px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-destructive"
                  style={{ opacity: tossHint }}
                >
                  Toss
                </div>

                <div className="border-b border-border px-6 py-4">
                  <h2 className="line-clamp-2 text-lg font-semibold">{thoughtTitle(current)}</h2>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                  {current.content.trim() ? (
                    <div className="ft-prose" dangerouslySetInnerHTML={{ __html: html }} />
                  ) : (
                    <p className="text-sm italic text-muted-foreground">(empty thought)</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex items-center gap-6">
              <button
                onClick={() => decide("left")}
                aria-label="Toss"
                className="flex size-14 items-center justify-center rounded-full border-2 border-destructive/40 text-destructive transition hover:bg-destructive hover:text-destructive-foreground [&_svg]:size-6"
              >
                <Trash2 />
              </button>
              <button
                onClick={() => decide("right")}
                aria-label="Keep"
                className="flex size-14 items-center justify-center rounded-full border-2 border-emerald-500/40 text-emerald-500 transition hover:bg-emerald-500 hover:text-white [&_svg]:size-6"
              >
                <Check />
              </button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Swipe, or use ← toss · keep →
            </p>
          </>
        ) : null}
      </div>

      {/* Undo bar */}
      {undo && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[111] -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-popover px-4 py-2.5 text-sm shadow-xl animate-scale-in">
            <span className="text-muted-foreground">Tossed “{thoughtTitle(undo)}”.</span>
            <button
              onClick={doUndo}
              className="flex items-center gap-1.5 font-medium text-primary hover:underline [&_svg]:size-3.5"
            >
              <RotateCcw /> Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
