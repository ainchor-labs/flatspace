/**
 * Shared real-time sync layer (`@flatspace/shared/sockets`).
 *
 * Yjs CRDT documents synced over Socket.io power live collaboration + presence
 * for both Flatfile and Flatdeck. Per the suite's build order, real-time is wired
 * up LAST — this module currently exposes the event-name contract and a no-op
 * attach function so the server can call it today without behavior change.
 *
 * Namespaced events (see suite rules):
 *   flatfile:update   flatfile:cursor   flatfile:presence
 *   flatdeck:slide:update   flatdeck:cursor   flatdeck:presence
 */

import type { AppId } from "../types/index.ts";

export const socketEvents = {
  flatfile: {
    update: "flatfile:update",
    cursor: "flatfile:cursor",
    presence: "flatfile:presence",
  },
  flatdeck: {
    update: "flatdeck:slide:update",
    cursor: "flatdeck:cursor",
    presence: "flatdeck:presence",
  },
} as const;

export function roomName(app: AppId, documentId: number): string {
  return `${app}:${documentId}`;
}

/**
 * Attach the Yjs/Socket.io handlers to an http server. No-op until the realtime
 * milestone — kept so the server's wiring is already in place.
 */
export function attachRealtime(_server: unknown): void {
  // TODO(realtime): bind Socket.io, sync Yjs docs, broadcast presence + cursors.
}
