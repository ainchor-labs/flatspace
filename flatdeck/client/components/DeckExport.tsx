/**
 * DeckExport — print-to-PDF preview for a deck.
 *
 * Mirrors Flatfile's export approach: an on-screen scrollable preview of every
 * slide, and a Print button that hands off to the browser's print dialog. The
 * @media print rules in flatdeck.css show only .deck-print-root, one slide per
 * landscape page, so "Save as PDF" produces a clean deck.
 */

import { Printer, X } from "lucide-react";
import { Button } from "@flatspace/shared/ui";
import type { DeckTheme, Slide } from "../lib/deck.ts";
import { SlideView } from "./SlideView.tsx";

export function DeckExport({
  slides,
  theme,
  title,
  onClose,
}: {
  slides: Slide[];
  theme: DeckTheme;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/70 backdrop-blur-sm">
      <div className="flex h-14 shrink-0 items-center justify-between px-4 print:hidden">
        <span className="truncate text-sm text-zinc-200">
          Export deck — <span className="font-medium">{title}</span>
        </span>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.print()}>
            <Printer /> Print / Save PDF
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-zinc-200 hover:text-white">
            <X /> Close
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-8 print:overflow-visible print:p-0">
        <div className="deck-print-root mx-auto flex max-w-4xl flex-col gap-6 print:max-w-none print:gap-0">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="deck-print-page overflow-hidden rounded-lg shadow-2xl print:rounded-none print:shadow-none"
            >
              <SlideView slide={slide} theme={theme} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
