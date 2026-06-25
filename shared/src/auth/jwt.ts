/**
 * JWT issue/verify helpers.
 *
 * Tokens are short-lived and stored in an httpOnly cookie (set in routes.ts).
 * The signing secret comes from FLATSPACE_JWT_SECRET; in development a stable
 * fallback is used with a loud warning so logins survive restarts.
 */

import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types/index.ts";

const DEV_SECRET = "flatspace-dev-secret-change-me";
const TOKEN_TTL = "7d";

let warned = false;

function secret(): string {
  const fromEnv = process.env.FLATSPACE_JWT_SECRET;
  if (fromEnv) return fromEnv;
  if (!warned) {
    console.warn(
      "[auth] FLATSPACE_JWT_SECRET not set — using insecure development secret. " +
        "Set it before exposing the server to your network.",
    );
    warned = true;
  }
  return DEV_SECRET;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret());
    if (typeof decoded === "string") return null;
    const { sub, username, role } = decoded as Record<string, unknown>;
    if (typeof sub !== "number" || typeof username !== "string") return null;
    if (role !== "admin" && role !== "member") return null;
    return { sub, username, role };
  } catch {
    return null;
  }
}
