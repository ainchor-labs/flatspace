/**
 * Document Format popover (top chrome) — document-level settings: margin preset
 * and the default font family + size for the whole document. Inline formatting
 * (bubble toolbar) overrides these per selection.
 */

import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import type { DocumentSettings, MarginPreset } from "@flatspace/shared/types";
import { cn } from "@flatspace/shared/lib";
import {
  DEFAULT_MARGIN,
  FONT_FAMILIES,
  FONT_SIZES,
  MARGIN_PRESETS,
} from "./formatting.ts";

export function DocFormatPopover({
  settings,
  onChange,
}: {
  settings: DocumentSettings;
  onChange: (patch: DocumentSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const margin: MarginPreset = settings.margin ?? DEFAULT_MARGIN;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Document format"
        aria-pressed={open}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
      >
        <Settings2 /> Format
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-popover p-3 shadow-2xl animate-scale-in">
          <Section title="Margins">
            <div className="grid grid-cols-2 gap-1.5">
              {MARGIN_PRESETS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onChange({ margin: m.id })}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-sm transition",
                    margin === m.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Default font">
            <select
              value={settings.fontFamily ?? ""}
              onChange={(e) => onChange({ fontFamily: e.target.value || undefined })}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Default (Inter)</option>
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Section>

          <Section title="Default size">
            <select
              value={settings.fontSize ?? ""}
              onChange={(e) => onChange({ fontSize: e.target.value || undefined })}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Default (16px)</option>
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("px", "")}
                </option>
              ))}
            </select>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}
