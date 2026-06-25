/**
 * Inline formatting controls for the bubble toolbar: font family, font size,
 * text color, and highlight color. Each is a small self-contained dropdown so
 * it works inside the floating (tippy) bubble menu.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { Baseline, ChevronDown, Highlighter } from "lucide-react";
import { cn } from "@flatspace/shared/lib";
import {
  FONT_FAMILIES,
  FONT_SIZES,
  HIGHLIGHT_COLORS,
  TEXT_COLORS,
} from "./formatting.ts";

function Dropdown({
  trigger,
  children,
  width = "w-48",
}: {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  width?: string;
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1 rounded-md px-1.5 text-sm text-foreground transition hover:bg-accent [&_svg]:size-3.5 [&_svg]:text-muted-foreground"
      >
        {trigger(open)}
      </button>
      {open && (
        <div
          className={cn(
            "absolute left-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-2xl animate-scale-in",
            width,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function Row({ onClick, children, active }: { onClick: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition hover:bg-accent",
        active && "text-primary",
      )}
    >
      {children}
    </button>
  );
}

export function FontFamilyControl({ editor }: { editor: Editor }) {
  const current = editor.getAttributes("textStyle").fontFamily as string | undefined;
  const label = FONT_FAMILIES.find((f) => f.value === current)?.label.split(" — ").pop();
  return (
    <Dropdown
      width="w-52"
      trigger={() => (
        <>
          <span className="max-w-24 truncate">{label ?? "Font"}</span>
          <ChevronDown />
        </>
      )}
    >
      {(close) => (
        <>
          <Row
            active={!current}
            onClick={() => {
              editor.chain().focus().unsetFontFamily().run();
              close();
            }}
          >
            Default
          </Row>
          {FONT_FAMILIES.map((f) => (
            <Row
              key={f.value}
              active={current === f.value}
              onClick={() => {
                editor.chain().focus().setFontFamily(f.value).run();
                close();
              }}
            >
              <span style={{ fontFamily: f.value }}>{f.label}</span>
            </Row>
          ))}
        </>
      )}
    </Dropdown>
  );
}

export function FontSizeControl({ editor }: { editor: Editor }) {
  const current = editor.getAttributes("textStyle").fontSize as string | undefined;
  return (
    <Dropdown
      width="w-28"
      trigger={() => (
        <>
          <span className="tabular-nums">{current ? current.replace("px", "") : "Size"}</span>
          <ChevronDown />
        </>
      )}
    >
      {(close) => (
        <>
          <Row
            active={!current}
            onClick={() => {
              editor.chain().focus().unsetFontSize().run();
              close();
            }}
          >
            Default
          </Row>
          {FONT_SIZES.map((s) => (
            <Row
              key={s}
              active={current === s}
              onClick={() => {
                editor.chain().focus().setFontSize(s).run();
                close();
              }}
            >
              <span className="tabular-nums">{s.replace("px", "")}</span>
            </Row>
          ))}
        </>
      )}
    </Dropdown>
  );
}

function Swatches({
  options,
  current,
  onPick,
}: {
  options: { label: string; value: string | null }[];
  current?: string;
  onPick: (value: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-1 p-1">
      {options.map((c) => (
        <button
          key={c.label}
          title={c.label}
          onClick={() => onPick(c.value)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md border transition hover:scale-110",
            current === c.value ? "border-primary ring-1 ring-primary" : "border-border",
            c.value === null && "text-[10px] text-muted-foreground",
          )}
          style={c.value ? { backgroundColor: c.value } : undefined}
        >
          {c.value === null ? "✕" : null}
        </button>
      ))}
    </div>
  );
}

export function TextColorControl({ editor }: { editor: Editor }) {
  const current = editor.getAttributes("textStyle").color as string | undefined;
  return (
    <Dropdown
      width="w-auto"
      trigger={() => (
        <span className="flex flex-col items-center leading-none">
          <Baseline className="!size-4" style={{ color: current ?? undefined }} />
        </span>
      )}
    >
      {(close) => (
        <Swatches
          options={TEXT_COLORS}
          current={current}
          onPick={(value) => {
            if (value) editor.chain().focus().setColor(value).run();
            else editor.chain().focus().unsetColor().run();
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

export function HighlightColorControl({ editor }: { editor: Editor }) {
  const current = editor.getAttributes("highlight").color as string | undefined;
  return (
    <Dropdown
      width="w-auto"
      trigger={() => <Highlighter className={cn("!size-4", editor.isActive("highlight") && "text-primary")} />}
    >
      {(close) => (
        <Swatches
          options={HIGHLIGHT_COLORS}
          current={current}
          onPick={(value) => {
            if (value) editor.chain().focus().setHighlight({ color: value }).run();
            else editor.chain().focus().unsetHighlight().run();
            close();
          }}
        />
      )}
    </Dropdown>
  );
}
