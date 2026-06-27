/**
 * Public surface of the shared auth package (`@flatspace/shared/auth`).
 */

export { authPlugin, AUTH_COOKIE } from "./plugin.ts";
export { authRoutes } from "./routes.ts";
export { signToken, verifyToken } from "./jwt.ts";
export { hashPassword, verifyPassword } from "./password.ts";
export { generateApiKey, hashApiKey, API_KEY_PREFIX } from "./apikey.ts";
export { pickAvatarColor, AVATAR_PALETTE } from "./avatar.ts";
