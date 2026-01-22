// src/frontend/shared/css-modules.ts
/**
 * CSS Modules strict accessor.
 *
 * Rules:
 * - Fails fast if a class is missing
 * - Eliminates `string | undefined` under strict TS
 * - Required when `noUncheckedIndexedAccess` is enabled
 */

export function mustClass(
  styles: Readonly<Record<string, string>>,
  name: string
): string {
  const v = styles[name];
  if (!v) throw new Error(`Missing CSS module class: ${name}`);
  return v;
}

/**
 * Small cx helper (optional) — safe join.
 */
export function cx(...parts: Array<string | null | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

