/**
 * Flatdeck editor entry (`@flatspace/flatdeck/editor`).
 *
 * Separate from the ./client dashboard barrel so the markdown-it bundle is only
 * pulled in on the deck editor route (lazy-loaded by the web host).
 */

export { DeckEditor } from "./components/DeckEditor.tsx";
