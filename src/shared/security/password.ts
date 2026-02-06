// src/shared/security/password.ts
/**
 * Password hashing utilities (canonical).
 *
 * Contract:
 * - Uses Argon2id
 * - Stores full PHC string (returned by argon2.hash)
 * - Never exposes raw salts or parameters
 */

import argon2 from "argon2";

/**
 * Canonical Argon2id settings.
 *
 * These are conservative v1 settings suitable for Node 20 / serverless.
 * Target: ~150–400ms per hash in production.
 */
const ARGON2_OPTS: Readonly<argon2.Options & { type: typeof argon2.argon2id }> = {
  type: argon2.argon2id,

  // Memory cost in KiB (65536 KiB = 64 MiB)
  memoryCost: 65_536,

  // Iterations
  timeCost: 3,

  // Degree of parallelism
  parallelism: 1,
};

/**
 * Hash a plaintext password using Argon2id.
 *
 * Output:
 * - PHC formatted string, e.g. $argon2id$v=19$m=...,t=...,p=...$salt$hash
 */
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, ARGON2_OPTS);
}

/**
 * Verify a plaintext password against a stored PHC hash.
 *
 * Returns:
 * - true if matches
 * - false if mismatch OR hash is invalid/corrupt
 */
export async function verifyPassword(
  storedHash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, password);
  } catch {
    return false;
  }
}

/**
 * Determines whether a stored hash should be upgraded to current parameters.
 *
 * Use after successful verification:
 * - if true → rehash password and store new hash
 */
export function needsRehash(storedHash: string): boolean {
  try {
    return argon2.needsRehash(storedHash, ARGON2_OPTS);
  } catch {
    // Invalid or legacy hash → force reset / upgrade path
    return true;
  }
}
