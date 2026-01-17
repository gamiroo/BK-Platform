# Balance Kitchen — Site UX & Design Specification (v2)

> **Scope:** Public Marketing Site (`src/frontend/site/**`)
>
> **Purpose:** Ensure a consistent, premium, calm, and system-driven UX across all pages and components.
>
> This document is the **single source of truth** for site-level UX, interaction patterns, and visual consistency.

---

## 0. Status and Change Log

**Status:** Approved (v2)

**What changed in v2 (high level):**
- Added framework-free implementation constraints (vanilla TypeScript + DOM rendering).
- Added explicit interaction and form UX standards aligned with strict TypeScript and accessibility.
- Added security/trust UX guidance aligned with BalanceGuard principles.
- Added performance discipline rules specific to a framework-free site.

---

## 🎯 1. Design Philosophy (Non-Negotiable)

Balance Kitchen is not a traditional food brand.

The site must communicate:
- ✨ Calm confidence
- ⚙️ Precision and control
- 💎 Premium restraint
- 👔 Adult, professional tone

Avoid:
- Loud marketing language
- Visual clutter
- Over-animation
- Fitness or influencer aesthetics

> **Whitespace, hierarchy, and consistency are features — not decoration.**

### 1.1 Engineering Model (Non-Negotiable)

This marketing site is **framework-free**.

Built with:
- Vanilla TypeScript
- Native DOM APIs
- CSS Modules + design tokens
- No component frameworks (React, Vue, etc.)

Implications:
- UI must be progressively enhanced.
- DOM structure must remain semantic and readable.
- Interactivity must degrade gracefully.
- No hidden state machines or framework-only interaction assumptions.

---

## 2. Theme & Tokens (Global Rules)

### 2.1 Token-Only Styling Rule

All styling **must** use semantic design tokens defined in the shared token system.

Token source of truth (example path):

```
src/shared/theme/tokens.css
```

Rules:
- ❌ No hex values in components
- ❌ No RGB/HSL values in components
- ❌ No component-specific color tokens
- ✅ Use semantic tokens only (e.g. `--bk-color-text`, `--bk-color-border`)

### 2.2 Light & Dark Mode

- Dark mode is **first-class**, not optional.
- Light mode must feel equally intentional.
- Theme switching is controlled via:

```html
<html data-theme="dark | light">
```

Components must:
- Work in both modes without overrides
- Never check theme in JS for styling decisions

### 2.3 Behavioral Consistency (Interaction Tokens)

Interaction behavior must be consistent across the site:
- Focus states
- Disabled states
- Loading states
- Error states
- Success states

No page or component may invent its own interaction semantics.

---

## 3. Typography System

### 3.1 Fonts (Free, Production-Ready)

| Role | Font | Usage |
|---|---|---|
| Display | Playfair Display | Hero, section headings, quotes |
| Sans / UI | Inter | Body text, buttons, navigation, forms |

Fonts must be provided via CSS variables:

```css
--font-family-display
--font-family-sans
```

### 3.2 Type Hierarchy

#### Headlines (Display Font)
- H1 (Hero): `clamp(3rem, 5vw, 4.5rem)`
- H2 (Section): `2.25rem`
- H3 (Subsection): `1.75rem`

Rules:
- Letter spacing: `-0.02em`
- Line height: `1.05–1.15`

#### Body Text (Sans)
- Base: `1rem`
- Large body: `1.125rem`
- Small / meta: `0.875rem`

Rules:
- Line height: `1.5–1.7`
- No justified text
- Short paragraphs preferred

---

## 4. Layout System

### 4.1 Grid

- Desktop: 12-column grid
- Max readable content width: ~72ch
- Content should rarely exceed 2/3 width

### 4.2 Spacing & Rhythm

All spacing must use spacing tokens.

Examples:
- Section padding (vertical): `var(--space-32)` → `var(--space-40)`
- Element gaps: `var(--space-8)` → `var(--space-20)`

Rules:
- Never stack elements tightly
- Generous vertical spacing signals quality

---

## 🧩 5. Components — Global Standards

### 5.1 Buttons ⭐ Stable

#### Primary Button ✅ Production Ready
- Background: `--color-accent-primary`
- Height: `48–52px``
- Radius: `--radius-8`
- Font: Inter, Medium

Hover:
- Slight lift (`translateY(-1px)`)
- Darker accent token

Disabled:
- Must visibly communicate disabled state
- Must remain readable in both themes

Loading:
- Must communicate progress without layout shift

#### Secondary Button / Link
- Text-only or outline
- Lower visual priority
- No underline by default

### 5.2 Cards & Surfaces

- Background: `--color-bg-surface`
- Radius: `--radius-12` or `--radius-16`
- Shadow: `--shadow-soft`

Rules:
- Cards should feel calm and grounded
- Avoid stacking too many cards in one viewport

### 5.3 Navigation

Navigation must be:
- Minimal
- Predictable
- Low cognitive load

Rules:
- Desktop: horizontal nav
- Mobile: a single accessible menu trigger
- No complex multi-level menus

Accessibility:
- Menu trigger must use `aria-expanded` and `aria-controls`
- Focus must be trapped in mobile nav (if modal/drawer)
- Escape closes mobile nav

---

## 6. Motion & Interaction

### 6.1 Motion Philosophy

Motion should:
- Guide attention
- Confirm actions
- Reduce cognitive load

Motion must **never**:
- Distract
- Delay content
- Feel playful

### 6.2 Motion Rules

- Duration: `120–200ms`
- Easing: `ease-out`
- Respect `prefers-reduced-motion`

Allowed:
- Fade + subtle translate
- Hover lift

Disallowed:
- Bounce
- Elastic easing
- Infinite animations

### 6.3 Forms & User Input (Required)

Forms must follow these rules:

Structure:
- Labels are always visible (no placeholder-only labels)
- Required fields clearly indicated
- Single-column layout by default (unless explicitly designed otherwise)

Validation:
- Validate on submit (and optionally on blur), not on every keystroke
- First invalid field receives focus
- Invalid fields must set `aria-invalid="true"`

Messaging:
- Use a live region for feedback:
  - `role="status"`
  - `aria-live="polite"`
- Avoid alarming language
- Show one primary message at a time

Submission:
- Disabled state prevents double submit
- Loading state must not cause layout shift

Anti-bot:
- Honeypot fields may be used
- Never expose bot rules to the user

---

## 7. Imagery & Media

### 7.1 Photography Direction

- Cinematic
- Editorial
- Moody lighting
- Real environments

Avoid:
- Stock-photo smiles
- Overly bright scenes
- Busy compositions

### 7.2 Usage Rules

- One strong image per section
- Images support text — never compete
- Prefer background images for hero sections

---

## 8. Navigation & Page Flow

### 8.1 Page Flow

Every page should follow:
1. Clear opening statement
2. Progressive disclosure
3. Single primary CTA

Avoid:
- Multiple competing CTAs
- Long feature lists

### 8.2 Content Tone

Tone must be:
- Adult
- Calm
- Confident

Avoid:
- Hype
- Slang
- Over-promising

---

## ♿ 9. Accessibility (Required) - WCAG AA Compliant

### Visual Standards
- ✅ Minimum 4.5:1 contrast ratio for normal text
- ✅ Minimum 3:1 contrast ratio for large text
- ✅ Focus indicators meet 3:1 contrast against background

### Interaction Standards
- ✅ All functionality available via keyboard
- ✅ Focus order follows visual order
- ✅ Sufficient time for users to read and use content

### Semantic Standards
- ✅ Proper heading hierarchy (H1 → H2 → H3)
- ✅ ARIA labels for icon-only controls
- ✅ Landmark regions for screen readers


Accessibility is not optional — it is part of quality.

---

## 10. Security & Trust UX

Security must be invisible but present.

Rules:
- Never display raw errors or stack traces
- No technical jargon in user-facing errors
- Fail calmly: generic error messages are preferred
- Do not reveal internal validation or anti-bot logic

User feedback should:
- Confirm actions
- Provide next steps
- Avoid anxiety-inducing language

---

## 11. Performance Discipline (Framework-Free)

Performance is part of UX.

Rules:
- Minimize DOM nodes
- Avoid layout thrashing (batch DOM reads/writes)
- Prefer CSS for simple animation
- Avoid heavy client-side re-render loops
- Defer non-critical work

Perceived performance matters:
- Fast first paint
- Immediate feedback on interaction

---

## 12. What This Site Is NOT

Explicit exclusions:
- Loud sales funnels
- Pricing calculators on homepage
- Macro tables
- Testimonials walls
- Trend-driven UI patterns

Those belong only where context demands them.

---

## 13. Consistency Checklist (Before Shipping)

Before any page ships, confirm:

- Uses tokens only
- Typography matches hierarchy
- Spacing follows rhythm rules
- Works in light & dark mode
- One primary CTA
- Calm, intentional feel
- Accessibility patterns applied
- Forms follow live-region and focus rules
- No raw errors or technical messaging
- Performance is acceptable (no obvious layout thrash)

If any item fails — revise.

