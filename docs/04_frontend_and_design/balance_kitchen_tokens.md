# balance_kitchen_tokens.md — Design Tokens & Theming Contract

> **Canonical design token system** for Balance Kitchen (BK).
>
> BK is framework-free:
>
> - **Frontend:** TypeScript + HTML + CSS Modules
> - **Backend:** TypeScript + Node.js
>
> This document defines the **only approved** way to style BK.

Related documents:

- `balance.md`
- `balance_kitchen_architecture.md`
- `balance_kitchen_toolkit.md`
- `balance_kitchen_site_ux_design_specification.md`

---

## 0. Non-Negotiables

1. **No hard-coded colors, spacing, radii, shadows, or typography values** in components.
2. **All UI styling must use tokens** via CSS variables.
3. Theme switching is controlled **only** by:

```html
<html data-theme="light | dark">
```

4. Components must never branch on theme in JavaScript.
5. CSS Modules are allowed, but must reference tokens only.
6. All interactive components must have accessible focus states (token-driven).

### Semantic Colors

| Token | Light Theme | Dark Theme | Usage |
|-------|-------------|------------|-------|
| `--bk-color-primary` | ![#4f0b00](https://via.placeholder.com/15/4f0b00/000000?text=+) `#4f0b00` | ![#d3af37](https://via.placeholder.com/15/d3af37/000000?text=+) `#d3af37` | Primary actions |
| `--bk-color-accent` | ![#d3af37](https://via.placeholder.com/15/d3af37/000000?text=+) `#d3af37` | ![#4f0b00](https://via.placeholder.com/15/4f0b00/000000?text=+) `#4f0b00` | Accent elements |

### Button States Visualization

| State | Background | Text | Border | Shadow |
|-------|------------|------|--------|--------|
| Default | `--bk-color-primary` | `--bk-color-primary-contrast` | None | `--bk-shadow-1` |
| Hover | Darken 10% | Same | None | `--bk-shadow-2` |
| Focus | Same | Same | None | `--bk-focus-ring` |
| Disabled | `--bk-color-surface-2` | `--bk-color-text-muted` | `--bk-border-1` | None |
| Loading | Same | Same | None | Spinner overlay |

---

## 1. Token Files & Ownership

### 1.1 Canonical paths

```text
src/shared/theme/
  tokens.css
  globals.css
  motion.css
```

- `tokens.css` is the source of truth for all CSS variables.
- `globals.css` sets base element styles and default typography.
- `motion.css` defines motion tokens and reduced-motion behavior.

### 1.2 Consumption

- Each frontend surface (site/client/admin) must import `globals.css` once in its entry file.

Example:

```ts
import "@/shared/theme/globals.css";
```

---

## 2. Token Naming Conventions

BK uses **semantic tokens**.

- **Primitive tokens** define a palette / scales.
- **Semantic tokens** map primitives to meaning (bg/text/border/etc.).
- Components use **semantic tokens only**.

Conventions:

- `--bk-<group>-<name>`
- Examples:
  - `--bk-color-bg`
  - `--bk-color-text`
  - `--bk-space-4`
  - `--bk-radius-3`

---

## 3. Theme Model

### 3.0 Theme Tokens

Theme tokens are actively switched at runtime via the global theme controller.
All surfaces (site, client, admin) must rely exclusively on semantic tokens and
must not branch on theme in component logic.

### 3.1 Light theme

- Default theme is `light`.

### 3.2 Dark theme

- Dark theme overrides semantic tokens under `html[data-theme="dark"]`.

### 3.3 No per-component theming

- Components do not define theme styles.
- Theme is global and driven entirely by token overrides.

---

## 4. Required Token Sets

BK must define tokens for:

- Colors (semantic + minimal primitives)
- Typography (font families, sizes, weights, line heights)
- Spacing scale
- Radii
- Borders
- Shadows
- Z-index
- Layout widths
- Motion (duration/easing) - including gamification-ready animations
- Focus ring

---

## 5. tokens.css (Canonical Example)

> This is the approved baseline. Extend as needed, but keep tokens semantic.

```css
:root {
  /* --------- Typography --------- */
  --bk-font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji";
  --bk-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;

  --bk-font-size-1: 0.75rem;
  --bk-font-size-2: 0.875rem;
  --bk-font-size-3: 1rem;
  --bk-font-size-4: 1.125rem;
  --bk-font-size-5: 1.25rem;
  --bk-font-size-6: 1.5rem;
  --bk-font-size-7: 1.875rem;
  --bk-font-size-8: 2.25rem;
  --bk-font-size-9: 3rem;

  --bk-font-weight-regular: 400;
  --bk-font-weight-medium: 500;
  --bk-font-weight-semibold: 600;
  --bk-font-weight-bold: 700;

  --bk-line-height-tight: 1.15;
  --bk-line-height-normal: 1.5;
  --bk-line-height-relaxed: 1.65;

  /* --------- Spacing --------- */
  --bk-space-0: 0;
  --bk-space-1: 0.25rem;
  --bk-space-2: 0.5rem;
  --bk-space-3: 0.75rem;
  --bk-space-4: 1rem;
  --bk-space-5: 1.25rem;
  --bk-space-6: 1.5rem;
  --bk-space-8: 2rem;
  --bk-space-10: 2.5rem;
  --bk-space-12: 3rem;
  --bk-space-16: 4rem;
  --bk-space-20: 5rem;
  --bk-space-24: 6rem;

  /* --------- Radii --------- */
  --bk-radius-1: 0.375rem;
  --bk-radius-2: 0.5rem;
  --bk-radius-3: 0.75rem;
  --bk-radius-4: 1rem;
  --bk-radius-round: 9999px;

  /* --------- Border widths --------- */
  --bk-border-1: 1px;
  --bk-border-2: 2px;

  /* --------- Shadows (semantic) --------- */
  --bk-shadow-1: 0 1px 2px rgba(0,0,0,0.08);
  --bk-shadow-2: 0 6px 18px rgba(0,0,0,0.12);
  --bk-shadow-3: 0 14px 40px rgba(0,0,0,0.16);

  /* --------- Z-index --------- */
  --bk-z-0: 0;
  --bk-z-10: 10;
  --bk-z-20: 20;
  --bk-z-30: 30;
  --bk-z-40: 40;
  --bk-z-50: 50;

  /* --------- Motion --------- */
  --bk-ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --bk-ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --bk-duration-1: 120ms;
  --bk-duration-2: 180ms;
  --bk-duration-3: 260ms;
  --bk-duration-4: 360ms;
  --bk-ease-spring: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* Bouncy spring effect */
  --bk-ease-elastic: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* Elastic entrance */
  --bk-ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1); /* Smooth and natural */
  
  --bk-duration-instant: 100ms;
  --bk-duration-quick: 200ms;
  --bk-duration-standard: 300ms;
  --bk-duration-deliberate: 400ms;
  --bk-duration-stately: 600ms;
  --bk-duration-slow: 800ms;


  /* --------- Layout --------- */
  --bk-container-max: 72rem;
  --bk-container-pad: var(--bk-space-4);

  /* --------- Primitive palette (minimal; do not use directly in components) --------- */
  --bk-p-neutral-0: #ffffff;
  --bk-p-neutral-950: #0b0b0d;
  --bk-p-neutral-900: #121218;
  --bk-p-neutral-800: #1b1b25;
  --bk-p-neutral-200: #e6e6ea;
  --bk-p-neutral-100: #f2f2f5;

  /* Brand primitives (allowed only via semantic mapping) */
  --bk-p-brand-gold: #d3af37;
  --bk-p-brand-burgundy: #4f0b00;

  /* --------- Semantic colors (components must use these) --------- */
  --bk-color-bg: var(--bk-p-neutral-0);
  --bk-color-surface: var(--bk-p-neutral-0);
  --bk-color-surface-2: var(--bk-p-neutral-100);
  --bk-color-text: #121218;
  --bk-color-text-muted: #4b4b56;
  --bk-color-border: rgba(18,18,24,0.12);

  --bk-color-primary: var(--bk-p-brand-burgundy);
  --bk-color-primary-contrast: var(--bk-p-neutral-0);
  --bk-color-accent: var(--bk-p-brand-gold);
  --bk-color-accent-contrast: #0b0b0d;

  --bk-color-success: #0f8a3b;
  --bk-color-warning: #b25e00;
  --bk-color-danger: #b00020;
  --bk-color-info: #1e5eff;

  /* Controls */
  --bk-color-control-bg: var(--bk-color-surface);
  --bk-color-control-bg-hover: var(--bk-color-surface-2);
  --bk-color-control-border: var(--bk-color-border);

  /* Focus */
  --bk-focus-ring: 0 0 0 3px rgba(211, 175, 55, 0.35);
}

html[data-theme="dark"] {
  --bk-color-bg: var(--bk-p-neutral-950);
  --bk-color-surface: var(--bk-p-neutral-900);
  --bk-color-surface-2: var(--bk-p-neutral-800);
  --bk-color-text: #f2f2f5;
  --bk-color-text-muted: rgba(242,242,245,0.72);
  --bk-color-border: rgba(242,242,245,0.14);

  --bk-color-primary: var(--bk-p-brand-gold);
  --bk-color-primary-contrast: #0b0b0d;
  --bk-color-accent: var(--bk-p-brand-burgundy);
  --bk-color-accent-contrast: #ffffff;

  --bk-color-control-bg: var(--bk-color-surface);
  --bk-color-control-bg-hover: var(--bk-color-surface-2);
  --bk-color-control-border: var(--bk-color-border);

  --bk-focus-ring: 0 0 0 3px rgba(211, 175, 55, 0.28);
}
```

---

## 6. globals.css (Canonical Example)

```css
@import "./tokens.css";

html {
  font-family: var(--bk-font-sans);
  background: var(--bk-color-bg);
  color: var(--bk-color-text);
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bk-color-bg);
  color: var(--bk-color-text);
  line-height: var(--bk-line-height-normal);
}

* {
  box-sizing: border-box;
}

a {
  color: inherit;
}

:focus-visible {
  outline: none;
  box-shadow: var(--bk-focus-ring);
}

::selection {
  background: rgba(211, 175, 55, 0.28);
}
```

---

## 7. motion.css (Reduced Motion)

```css
@import "./tokens.css";

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 8. CSS Modules Usage Rules

### 8.1 Allowed

```css
.card {
  background: var(--bk-color-surface);
  border: var(--bk-border-1) solid var(--bk-color-border);
  border-radius: var(--bk-radius-3);
  box-shadow: var(--bk-shadow-1);
  padding: var(--bk-space-6);
  color: var(--bk-color-text);
}

.cardTitle {
  font-size: var(--bk-font-size-6);
  font-weight: var(--bk-font-weight-semibold);
}
```

### 8.2 Not allowed

```css
/* ❌ hard-coded values */
.bad {
  background: #ffffff;
  padding: 18px;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}
```

---

## 9. Component Accessibility Tokens

If you introduce components like:

- buttons
- inputs
- menus
- dialogs

They must:

- have visible focus state
- meet 44px minimum touch target where possible
- use semantic HTML

Tokens to use:

- `--bk-focus-ring`
- spacing scale for padding
- semantic colors for control backgrounds/borders

---

## 10. Extending Tokens

When adding tokens:

- Prefer semantic names (what it means) over primitive names (what it is)
- Add the token to **both** themes
- Update any affected docs

Mandatory notification sentence (when changes are structural):

> “We will need to update [ document/s name ] as there has been changes that will need to be inserted.”

---

## 11. Session Tokens

Session cookies are surface-specific.

Production:
- __Host-bk_client_session
- __Host-bk_admin_session

Development:
- bk_client_session
- bk_admin_session


---

## 12. Summary

This token system ensures:

- consistent theming across site/client/admin
- strong accessibility defaults
- maintainable CSS Modules without hard-coded values

All BK UI must conform to this document.

## 📇 Quick Reference Card

### Typography Scale
H1: clamp(3rem, 5vw, 4.5rem) • H2: 2.25rem • H3: 1.75rem Body: 1rem • Large: 1.125rem • Small: 0.875rem

### Spacing Scale
0 • 0.25rem • 0.5rem • 0.75rem • 1rem • 1.25rem • 1.5rem • 2rem • 2.5rem • 3rem • 4rem • 5rem • 6rem

### Color Palette
Primary: Burgundy (#4f0b00) • Accent: Gold (#d3af37) Background: White (#ffffff) • Text: #121218

### Motion Tokens
Durations: 100ms • 200ms • 300ms • 400ms • 600ms • 800ms
Easings: standard • smooth • spring • elastic


