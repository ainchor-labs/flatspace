/**
 * Deterministic-ish avatar color assignment.
 *
 * Picks from a curated palette that reads well on the near-black UI. Used at
 * registration to give each user a stable color for their avatar + live cursor.
 */

import { AVATAR_PALETTE } from "../types/index.ts";

export { AVATAR_PALETTE };

const PALETTE = AVATAR_PALETTE;

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index] as string;
}
