/**
 * Flatthoughts client entry (`@flatspace/flatthoughts/client`).
 *
 * The dashboard + data hooks live here. The heavier editor/triage surfaces are
 * exported from ./editor so the web host can lazy-load them per route.
 */

export { FlatthoughtsDashboard } from "./components/FlatthoughtsDashboard.tsx";
export { FlatthoughtsSidebar } from "./components/FlatthoughtsSidebar.tsx";
export * from "./hooks/useFlatthoughts.ts";
export { thoughtTitle, thoughtSnippet, renderThoughtHtml, shortDate } from "./lib/thought.ts";
