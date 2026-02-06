// src/shared/http/clone-headers.ts
/**
 * Clone Headers while preserving multiple Set-Cookie values.
 *
 * Why:
 * - In Fetch/undici, Set-Cookie is special (it must not be combined).
 * - new Headers(existing) and headers.forEach(...) can lose/merge Set-Cookie.
 *
 * Node/undici provides headers.getSetCookie() which returns string[].
 */
export function cloneHeadersPreserveSetCookie(src: Headers): Headers {
  const out = new Headers();

  // Copy all non-Set-Cookie headers normally.
  src.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    out.set(key, value);
  });

  // Preserve Set-Cookie values (multiple header lines).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anySrc = src as any;

  const cookies: unknown =
    typeof anySrc.getSetCookie === "function" ? (anySrc.getSetCookie() as unknown) : undefined;

  if (Array.isArray(cookies)) {
    for (const c of cookies) {
      if (typeof c === "string" && c.length > 0) out.append("set-cookie", c);
    }
  } else {
    // Fallback: single Set-Cookie (better than losing it)
    const single = src.get("set-cookie");
    if (single && single.length > 0) out.append("set-cookie", single);
  }

  return out;
}
