/**
 * Table size picker — a hover grid for choosing rows × columns when inserting a
 * table from the slash menu (Google-Docs / Notion style). Anchored to the caret.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@flatspace/shared/lib";

const MAX_ROWS = 8;
const MAX_COLS = 10;

export interface PickerAnchor {
  left: number;
  top: number;
}

export function TableSizePicker({
  anchor,
  onSelect,
  onClose,
}: {
  anchor: PickerAnchor;
  onSelect: (rows: number, cols: number) => void;
  onClose: () => void;
}) {
  const [hover, setHover] = useState({ rows: 1, cols: 1 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Keep the picker on-screen when anchored near the right/bottom edges.
  const left = Math.min(anchor.left, window.innerWidth - 280);
  const top = Math.min(anchor.top, window.innerHeight - 230);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left, top, zIndex: 130 }}
      className="rounded-lg border border-border bg-popover p-3 shadow-2xl animate-scale-in"
    >
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 1.1rem)` }}
        onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
      >
        {Array.from({ length: MAX_ROWS * MAX_COLS }).map((_, i) => {
          const row = Math.floor(i / MAX_COLS) + 1;
          const col = (i % MAX_COLS) + 1;
          const active = row <= hover.rows && col <= hover.cols;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover({ rows: row, cols: col })}
              onClick={() => onSelect(row, col)}
              className={cn(
                "size-[1.1rem] rounded-[3px] border transition-colors",
                active ? "border-primary bg-primary/70" : "border-border bg-card hover:border-primary/40",
              )}
              aria-label={`${row} by ${col}`}
            />
          );
        })}
      </div>
      <div className="mt-2 text-center text-xs tabular-nums text-muted-foreground">
        {hover.rows > 0 ? `${hover.rows} × ${hover.cols}` : "Pick a size"}
      </div>
    </div>
  );
}
