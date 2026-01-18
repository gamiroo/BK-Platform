// src/shared/security/balanceguard/types.ts
// Shared BalanceGuard types.
// Keep these stable: many layers import them.

export type Surface = "site" | "client" | "admin";

export type Actor =
  | { type: "anon" }
  | { type: "client"; client_id: string }
  | { type: "admin"; admin_id: string };

export type BalanceGuardOptions = Readonly<{
  surface: Surface;

  /**
   * If true, we enforce Origin checks (recommended for authenticated surfaces).
   * For Day 0 /health we keep it relaxed, but the hooks are here.
   */
  requireOrigin?: boolean;

  /**
   * If true, enforce CSRF for unsafe methods (POST/PUT/PATCH/DELETE).
   * For Day 0 /health we keep it relaxed.
   */
  requireCsrf?: boolean;
}>;
