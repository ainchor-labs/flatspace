/**
 * Design-system runtime helpers (`@flatspace/shared/design`).
 *
 * The CSS tokens live in tokens.css and the Tailwind preset in tailwind-preset.cjs;
 * this module exposes the theme list used by the Flatdeck theme picker and any
 * runtime theme switching.
 */

export type ThemeName = "dark" | "light" | "indigo" | "slate" | "rose";

export interface ThemeMeta {
  name: ThemeName;
  label: string;
  /** Preview swatch for the theme picker. */
  swatch: string;
}

export const THEMES: ThemeMeta[] = [
  { name: "dark", label: "Dark", swatch: "#0f0f0f" },
  { name: "light", label: "Light", swatch: "#ffffff" },
  { name: "indigo", label: "Indigo", swatch: "#6366f1" },
  { name: "slate", label: "Slate", swatch: "#334155" },
  { name: "rose", label: "Rose", swatch: "#f43f5e" },
];
