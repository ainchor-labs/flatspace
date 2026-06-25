/**
 * Heavy editor entry (`@flatspace/flatfile/editor`).
 *
 * Kept separate from the dashboard barrel (`./client`) so the TipTap + lowlight
 * bundle is only pulled into the lazily-loaded editor route, not the dashboard.
 */

export { DocumentEditor } from "./components/editor/DocumentEditor.tsx";
export { useDocument, type SaveStatus } from "./hooks/useDocument.ts";
