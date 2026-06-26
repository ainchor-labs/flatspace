/**
 * Flatthoughts editor entry (`@flatspace/flatthoughts/editor`).
 *
 * The interactive, full-focus surfaces — view/edit, compose, and triage. Pulled
 * in lazily by the web host so markdown-it only loads on these routes.
 */

export { ThoughtEditor } from "./components/ThoughtEditor.tsx";
export { NewThought } from "./components/NewThought.tsx";
export { TriageMode } from "./components/TriageMode.tsx";
