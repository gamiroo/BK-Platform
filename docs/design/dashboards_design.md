# dashboards_design.md — Client + Admin Dashboard UX & Scaffolding Spec (v1)

> Canonical design + scaffolding specification for Balance Kitchen dashboards.
>
> This document defines **shared layout patterns**, **navigation**, **page scaffolding**, and **token-driven styling rules** for both dashboard surfaces:
>
> - **Client dashboard** (`/client/*`)
> - **Admin dashboard** (`/admin/*`)
>
> It is intentionally scoped to **scaffolding + UX structure** (not feature implementation).
>
> Related documents:
> - `balance.md`
> - `balance_kitchen_architecture.md`
> - `balanceguard.md`
> - `balance_kitchen_tokens.md`
> - `balance_kitchen_toolkit.md`
> - `balance_kitchen_business_model.md`
> - `balance_kitchen_site_ux_design_specification_v_2.md`

---

## 0. Decision: One document, two surface sections

BK dashboards are **two separate surfaces** (client vs admin), but they share:

- the same platform principles (framework-free, DDD, BalanceGuard)
- a shared UX grammar (shell → navigation → content grid → cards)
- consistent a11y and token usage

Therefore this spec is **one joint document** with:

- shared rules up front
- separate, explicit sections for **Client** and **Admin** differences

> If/when either surface becomes meaningfully complex (e.g., admin gets dense operational tooling), we can split into:
> - `client_dashboard_design.md`
> - `admin_dashboard_design.md`
> while keeping a small shared `dashboard_shell_patterns.md`.

---

## 1. Scaffold definition of “Done”

A dashboard scaffold is considered **done** when both surfaces have:

- Stable routes (`/client/*`, `/admin/*`)
- Auth gate + redirect logic (no flicker)
- A surface App Shell (header/nav/main/footer)
- A Home page composed of placeholder blocks that match future modules
- A minimal navigation map (links may be placeholders)
- A Debug panel behind a single dev flag
- Consistent empty/error states (no floating error blocks)

---

## 2. Non-negotiable UX + engineering rules

### 2.1 Token-only styling

Per `balance_kitchen_tokens.md`:

- No hard-coded color/spacing/radius/shadow/typography values in CSS Modules.
- Only `var(--bk-...)` tokens are allowed in component CSS.
- Focus styles must be visible and token-driven.

### 2.2 Accessibility baseline

- A **Skip to content** link exists in every dashboard header.
- Navigation is keyboard-operable.
- Focus ring is always visible.
- No icon-only controls without accessible labels.
- Respect reduced motion (if animation is introduced later, use the motion tokens and `prefers-reduced-motion`).

### 2.3 Surface separation

Client and Admin are separate surfaces. They must not:

- share session cookies
- call each other’s auth endpoints
- render each other’s navigation

---

## 3. Information architecture

### 3.1 Shared layout

All dashboard pages follow this structure:

1. **Header** (brand, surface label, account controls)
2. **Nav** (primary sections)
3. **Main**
   - Page title
   - Page intro (optional)
   - Content grid
4. **Footer** (minimal)

### 3.2 Card grammar

Dashboard content is composed from “blocks” (cards) with:

- a title row
- optional subtext
- content (placeholder, list, table, controls)
- optional footer actions

Cards should feel:

- calm
- operational
- not gamified

---

## 4. Routing & entrypoints

### 4.1 Admin

- Routes:
  - `/admin/login`
  - `/admin/dashboard`
  - `/admin/*` → surface Not Found inside admin shell

- Server route group:
  - `registerAdminRoutes(router)` registered in `src/server/http/server.ts`

- Admin auth endpoints:
  - `/api/admin/auth/login`
  - `/api/admin/auth/logout`
  - `/api/admin/auth/me`

### 4.2 Client

- Routes:
  - `/client/login`
  - `/client/dashboard`
  - `/client/*` → surface Not Found inside client shell

- Server route group:
  - `registerClientRoutes(router)` registered in `src/server/http/server.ts`

- Client auth endpoints:
  - `/api/auth/login`
  - `/api/auth/logout`
  - `/api/auth/me`

---

## 5. App Shell specifications

### 5.1 Shared header requirements

Header contains:

- Brand mark + text
- Surface label ("Client" or "Admin")
- Skip link (visible on focus)
- Account menu placeholder
- Logout button (wired)

### 5.2 Admin App Shell

Navigation (placeholders allowed):

- Dashboard
- Clients
- Orders
- Menu
- Deliveries
- Chat / Support
- Audit log
- Settings

### 5.3 Client App Shell

Navigation (placeholders allowed):

- Dashboard
- Order menu
- Packs / Subscription
- Deliveries
- Payments / History
- Favourites
- Support chat
- Profile

---

## 6. Dashboard Home placeholders

Both dashboard homes use a **bento box** layout: a responsive grid of cards with varied row/column spans.

Principles:

- Use a single grid container per page.
- Cards span columns/rows to create a “bento” rhythm.
- Cards must remain readable at all breakpoints (no cramped 2-column grids on small screens).
- No decorative color blocks; keep surfaces neutral and token-driven.

### 6.0 Bento grid layout rules (shared)

**Breakpoints (token-driven):**

- Mobile: 1 column (stacked)
- Tablet: 2 columns
- Desktop: 3–4 columns (depending on available width)

**Card span conventions:**

- “Hero” cards may span 2 columns on desktop.
- “List/table” cards may span 2 columns to reduce truncation.
- Debug card is always last and visually muted.

**Suggested grid spans (desktop 12-col mental model, implemented as 3–4 equal columns):**

- 2-col span cards: primary operational blocks
- 1-col span cards: secondary status blocks

### 6.1 Admin dashboard home bento blocks

Place blocks into the bento grid with typical spans:

- Overview KPI block — **wide** (span 2 cols)
- Operational queue — **wide** (span 2 cols)
  - Orders requiring attention
  - Deliveries pending
- Quick actions — **single** (span 1 col)
- Recent activity / audit preview — **wide** (span 2 cols)
- Debug panel (dev-only) — **single**, muted

### 6.2 Client dashboard home bento blocks

Typical spans:

- Pack / credits balance — **wide** (span 2 cols)
- Next delivery — **single**
- This week’s menu — **wide** (span 2 cols)
- Recent orders — **wide** (span 2 cols)
- Your plan — **single**
- Support — **single**
- Debug panel (dev-only) — **single**, muted

---

## 6A. Bento CSS Modules + tokens (reference)

This section is **guidance**, not a component inventory.

### 6A.1 Grid container (token-driven)

Use tokens from `balance_kitchen_tokens.md` and `src/shared/theme/tokens.css`.

Suggested CSS Modules patterns:

- Grid gap uses `--bk-space-*`
- Card background uses `--bk-color-surface-*`
- Border radius uses `--bk-radius-*`
- Shadows use `--bk-shadow-*`
- Border uses `--bk-border-*`

### 6A.2 Example spans

Represent spans with semantic classes:

- `.span2` (wide)
- `.spanRow2` (taller)

Do not hardcode pixel breakpoints or values; use existing responsive tokens/utilities if present.

---

## 7. Authentication UX scaffold

### 7.1 /me bootstrap

On app start:

1. call `/me`
2. if anonymous → route to login
3. if wrong actor kind for surface → force logout → route to login
4. in dev only: show actor JSON in Debug block

### 7.2 Consistent message presentation

Login pages:

- No error container until a submit fails
- Success/info appear above the primary button

Dashboards:

- Don’t show “logout error” unless logout actually fails
- Clear transient messages on navigation

> Implementation note: the UX calls for a small reusable message UI, but adding a new canonical component must follow `balance_kitchen_toolkit.md` governance.

---

## 8. Feature stub integration points

For each future module, the scaffold should include:

- placeholder route + page
- placeholder API client file
- placeholder server route entry (BalanceGuard-wrapped)
- placeholder home block (if relevant)

Example pattern:

- `src/frontend/admin/pages/orders/page.ts` (Coming soon)
- `src/server/http/routes/admin.orders.routes.ts` (later)
- `src/modules/orders/**` (later)

---

## 9. Minimal scaffold tests

Scaffold-level tests focus on edge/security correctness:

- Admin routes reject client session
- Client routes reject admin session
- `/me` returns expected actor per cookie
- logout requires correct surface cookie
- cookie separation tests remain

UI tests are deferred until scaffolding stabilizes.

---

## 10. CSS Modules + token usage examples

### 10.1 Shell layout tokens

Use tokens such as:

- spacing: `--bk-space-*`
- borders: `--bk-border-*`
- radii: `--bk-radius-*`
- shadows: `--bk-shadow-*`
- typography: `--bk-font-*`
- semantic colors: `--bk-color-bg`, `--bk-color-surface-*`, `--bk-color-text`, `--bk-color-text-muted`, `--bk-color-primary`, `--bk-color-primary-contrast`

### 10.2 Focus ring

All interactive elements must use the shared focus ring token (defined in `tokens.css`).

---

## 11. Change log

- v1: initial scaffold UX + structural rules for client/admin dashboards

