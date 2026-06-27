/**
 * API key generation + hashing for the programmatic REST API (/api/v1).
 *
 * A key is `fsk_` + 40 hex chars (20 random bytes). We never store the raw key:
 * only its SHA-256 hash (for constant-shape lookup) and a short, non-secret
 * `prefix` (for display in the key list). SHA-256 is appropriate here — unlike
 * passwords these are high-entropy random tokens, so no slow KDF is needed.
 */

import { createHash, randomBytes } from "node:crypto";

/** Human-recognizable scheme prefix, so a leaked key is easy to grep/identify. */
export const API_KEY_PREFIX = "fsk_";

/** Characters of the key kept for display (scheme prefix + first 8 of the body). */
const DISPLAY_PREFIX_LEN = API_KEY_PREFIX.length + 8;

/** SHA-256 hex digest of a raw key — the value stored in api_keys.key_hash. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Mint a fresh key. Returns the raw key (show once, never persisted), its hash
 * (store this), and a display prefix (store this).
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = API_KEY_PREFIX + randomBytes(20).toString("hex");
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, DISPLAY_PREFIX_LEN) };
}
