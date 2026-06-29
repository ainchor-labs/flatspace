/**
 * PresentMode — fullscreen presentation overlay.
 *
 * Renders one slide at a time, letterboxed to fit the viewport at 16:9. Navigate
 * with arrows / space / click; Esc (or the close button) exits. The deck's
 * transition animates slide changes. Press "N" (or the notes button) to toggle a
 * speaker-notes panel that only the presenter sees. Requests native fullscreen on
 * open as a best-effort nicety.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, StickyNote, X } from "lucide-react";
import type { DeckTheme, DeckTransition, Slide } from "../lib/deck.ts";
import { SlideView } from "./SlideView.tsx";

const ANIM: Record<DeckTransition, string> = {
  none: "",
  fade: "deck-anim-fade",
  slide: "deck-anim-slide",
};

export function PresentMode({
  slides,
  theme,
  transition = "none",
  startIndex = 0,
  onClose,
}: {
  slides: Slide[];
  theme: DeckTheme;
  transition?: DeckTransition;
  startIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [showNotes, setShowNotes] = useState(false);

  const clamp = useCallback((n: number) => Math.max(0, Math.min(slides.length - 1, n)), [slides.length]);
  // Advancing past the final slide exits the presentation (PowerPoint-style).
  const next = useCallback(() => {
    if (index >= slides.length - 1) onClose();
    else setIndex(index + 1);
  }, [index, slides.length, onClose]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        case "Home":
          setIndex(0);
          break;
        case "End":
          setIndex(slides.length - 1);
          break;
        case "n":
        case "N":
          setShowNotes((v) => !v);
          break;
        case "Escape":
          onClose();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose, slides.length]);

  // Best-effort native fullscreen; ignore if the browser refuses.
  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const idx = clamp(index);
  const slide = slides[idx];
  if (!slide) return null;
  const notes = slide.notes?.trim();

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-black">
      <button
        className="flex flex-1 items-center justify-center overflow-hidden"
        onClick={next}
        aria-label="Next slide"
      >
        <div key={idx} className={`aspect-video w-[min(100vw,177.78vh)] ${ANIM[transition]}`}>
          <SlideView slide={slide} theme={theme} />
        </div>
      </button>

      {/* Speaker notes (presenter only) */}
      {showNotes && (
        <div className="max-h-[28vh] shrink-0 overflow-y-auto border-t border-white/15 bg-neutral-900 px-6 py-4 text-white">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Speaker notes · slide {idx + 1}
          </div>
          {notes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{notes}</p>
          ) : (
            <p className="text-sm italic text-white/40">No notes for this slide.</p>
          )}
        </div>
      )}

      {/* Controls (hidden until hover near the bottom) */}
      <div className="group absolute inset-x-0 bottom-0 flex h-16 items-center justify-center">
        <div className="flex items-center gap-3 rounded-full bg-white/10 px-3 py-1.5 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
          <button onClick={prev} disabled={idx === 0} aria-label="Previous" className="disabled:opacity-30 [&_svg]:size-5">
            <ChevronLeft />
          </button>
          <span className="min-w-14 text-center text-sm tabular-nums">
            {idx + 1} / {slides.length}
          </span>
          <button
            onClick={next}
            disabled={idx === slides.length - 1}
            aria-label="Next"
            className="disabled:opacity-30 [&_svg]:size-5"
          >
            <ChevronRight />
          </button>
          <span className="mx-0.5 h-4 w-px bg-white/20" />
          <button
            onClick={() => setShowNotes((v) => !v)}
            aria-label="Toggle speaker notes"
            aria-pressed={showNotes}
            className={`rounded [&_svg]:size-5 ${showNotes ? "text-white" : "text-white/60 hover:text-white"}`}
          >
            <StickyNote />
          </button>
        </div>
      </div>

      <button
        onClick={onClose}
        aria-label="Exit presentation"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white opacity-0 backdrop-blur transition hover:bg-white/20 focus:opacity-100 [&_svg]:size-5 [&:hover]:opacity-100"
      >
        <X />
      </button>
    </div>
  );
}
