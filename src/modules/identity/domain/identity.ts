// src/modules/identity/domain/identity.ts
/**
 * Identity domain types (v1).
 *
 * Rules:
 * - Domain types are small and explicit.
 * - Domain must not depend on HTTP, cookies, DB, or any transport concerns.
 */

export type IdentityUserStatus = "active" | "inactive" | "invited" | "disabled";

export type IdentityUserRole = "client" | "admin";

export type IdentityUser = Readonly<{
  id: string;
  email: string;

  /**
   * Domain-level status (lowercase).
   * DB may store uppercase; repository maps DB -> domain.
   */
  status: IdentityUserStatus;

  /**
   * "client" or "admin" for v1.
   * In future, this becomes account_memberships + RBAC.
   */
  role: IdentityUserRole;

  /**
   * Password hash is nullable for invited users, SSO-only users, etc.
   */
  passwordHash: string | null;
}>;

export type AuthActor =
  | Readonly<{ kind: "client"; role: "client"; user_id: string }>
  | Readonly<{ kind: "admin"; role: "admin"; user_id: string }>;
