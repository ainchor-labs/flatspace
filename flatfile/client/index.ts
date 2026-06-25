/**
 * Flatfile client entry (`@flatspace/flatfile/client`).
 * Exports the dashboard surface consumed by the web host.
 */

export { FlatfileDashboard } from "./components/dashboard/FlatfileDashboard.tsx";
export { FlatfileSidebar, type FlatfileView } from "./components/dashboard/FlatfileSidebar.tsx";
export { DocCard } from "./components/dashboard/DocCard.tsx";
export * from "./hooks/useFlatfile.ts";
// The editor (TipTap) lives behind its own entry: `@flatspace/flatfile/editor`.
