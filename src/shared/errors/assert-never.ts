// src/shared/errors/assert-never.ts
/**
 * Exhaustiveness helper for discriminated unions.
 * Use in switches to ensure all cases are handled.
 */

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}
