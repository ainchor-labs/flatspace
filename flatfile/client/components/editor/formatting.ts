/**
 * Formatting option catalogues shared by the bubble toolbar, format popover, and
 * export preview. Fonts are limited to families the suite bundles locally (Inter,
 * Lora, JetBrains Mono) plus safe system stacks — no CDN.
 */

import type { MarginPreset } from "@flatspace/shared/types";

export interface FontOption {
  label: string;
  value: string;
}

export const FONT_FAMILIES: FontOption[] = [
  { label: "Sans — Inter", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Serif — Lora", value: "Lora, Georgia, 'Times New Roman', serif" },
  { label: "Mono — JetBrains", value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "System UI", value: "system-ui, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
];

export const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "30px", "36px"];

export const DEFAULT_FONT = FONT_FAMILIES[0]!.value;
export const DEFAULT_SIZE = "16px";

export interface ColorOption {
  label: string;
  value: string | null;
}

export const TEXT_COLORS: ColorOption[] = [
  { label: "Default", value: null },
  { label: "Gray", value: "#a1a1aa" },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Green", value: "#22c55e" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
];

export const HIGHLIGHT_COLORS: ColorOption[] = [
  { label: "None", value: null },
  { label: "Yellow", value: "#fde68a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Purple", value: "#ddd6fe" },
  { label: "Orange", value: "#fed7aa" },
];

export interface MarginOption {
  id: MarginPreset;
  label: string;
  /** Content column max-width. */
  maxWidth: string;
  /** Horizontal padding. */
  padX: string;
}

export const MARGIN_PRESETS: MarginOption[] = [
  { id: "narrow", label: "Narrow", maxWidth: "38rem", padX: "2rem" },
  { id: "normal", label: "Normal", maxWidth: "48rem", padX: "2rem" },
  { id: "wide", label: "Wide", maxWidth: "64rem", padX: "2.5rem" },
  { id: "full", label: "Full width", maxWidth: "100%", padX: "3rem" },
];

export const DEFAULT_MARGIN: MarginPreset = "normal";

export function marginById(id: MarginPreset | undefined): MarginOption {
  return MARGIN_PRESETS.find((m) => m.id === id) ?? MARGIN_PRESETS[1]!;
}
