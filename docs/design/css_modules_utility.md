# Shared CSS Modules Utility

This utility exists to safely bridge **CSS Modules** with **strict TypeScript settings** (`noUncheckedIndexedAccess: true`).

It guarantees that a class name exists at runtime and **fails fast** if a CSS key is missing, preventing silent styling bugs.

---

## File Location (Recommended)

```
src/frontend/site/shared/css-modules.ts
```

This keeps the helper:
- Frontend-only (not shared with server code)
- Reusable across all site components and pages
- Consistent with the framework-free DOM rendering approach

---

## Implementation

```ts
/**
 * CSS Modules helper for strict TypeScript mode.
 *
 * Why this exists:
 * - With `noUncheckedIndexedAccess: true`, `styles.foo` is typed as `string | undefined`
 * - DOM APIs like `element.className` require a definite `string`
 *
 * This helper:
 * - Guarantees a string at compile-time
 * - Throws immediately at runtime if a class key is missing
 * - Makes CSS typos obvious instead of silently breaking layout
 */
export function mustClass(
  styles: Record<string, string | undefined>,
  key: string,
): string {
  const value = styles[key];

  if (!value) {
    // Fail fast: missing CSS class is always a developer error
    throw new Error(`Missing CSS module class: ${key}`);
  }

  return value;
}

/**
 * Optional helper if you want to combine multiple classes safely.
 *
 * Example:
 *   el.className = cx(styles, 'button', isActive && 'active');
 */
export function cx(
  styles: Record<string, string | undefined>,
  ...keys: Array<string | false | null | undefined>
): string {
  return keys
    .filter((k): k is string => typeof k === 'string')
    .map((k) => mustClass(styles, k))
    .join(' ');
}
```

---

## Usage Examples

### Single class

```ts
import { mustClass } from '../shared/css-modules';
import styles from './page.module.css';

el.className = mustClass(styles, 'hero');
```

### Multiple classes (optional helper)

```ts
import { cx } from '../shared/css-modules';

el.className = cx(styles, 'button', isPrimary && 'primary');
```

---

## Why This Is the Preferred Pattern

- ✅ Works with strict TS settings
- ✅ Prevents silent styling regressions
- ✅ Keeps DOM code clean and readable
- ✅ Framework-free and future-proof

This helper should be used **everywhere** CSS Modules are applied in the site.

