# Dashboards UX & Scaffolding Specification — Client + Admin (v2)

> Canonical UX, layout, and scaffolding specification for **Balance Kitchen dashboards**.
>
> This document defines **shared shell patterns**, **navigation**, **page scaffolds**, and **token‑driven UI rules** for both dashboard surfaces:
>
> - **Client Dashboard** (`/client/*`)
> - **Admin Dashboard** (`/admin/*`)
>
> Scope: **structure and UX only**. Feature logic and data flows are explicitly out of scope.

---

## 1. Purpose & Philosophy

Dashboards in Balance Kitchen are operational tools, not marketing surfaces.

They must feel:
- calm
- deliberate
- predictable
- accessible

Both dashboards follow the same UX grammar while remaining **strictly separated surfaces**.

This document intentionally prioritises:
- clarity over density
- determinism over cleverness
- scaffolding over feature completeness

---

## 2. Document Structure Decision

This is a **single shared specification** with:
- shared rules and primitives up front
- explicit surface‑specific sections later

Rationale:
- shared platform constraints (framework‑free, BalanceGuard, tokens)
- shared visual language
- reduced drift between client and admin

If either surface becomes significantly more complex, this document may later be split into:
- `dashboard_shell_patterns.md`
- `client_dashboard_design.md`
- `admin_dashboard_design.md`

---

## 3. Definition of “Scaffold Complete”

A dashboard surface is considered **scaffold‑complete** when it has:

- Stable route namespace (`/client/*`, `/admin/*`)
- Auth gating with redirect (no UI flicker)
- Surface‑specific App Shell
- Home page composed of **module‑aligned placeholders**
- Minimal but complete navigation map
- Consistent empty, loading, and error states
- Debug panel behind a single dev flag

Feature functionality is not required at this stage.

---

## 4. Non‑Negotiable Rules

### 4.1 Token‑Only Styling

Per `balance_kitchen_tokens.md`:

- No hard‑coded values in CSS Modules
- Only `var(--bk-*)` tokens may be used
- Includes spacing, color, radius, typography, motion
- Focus styles must be visible and token‑driven

### 4.2 Accessibility Baseline

Every dashboard must include:

- Skip‑to‑content link (visible on focus)
- Keyboard‑operable navigation
- Visible focus rings on all interactive elements
- Accessible labels for icon‑only controls
- Respect for `prefers-reduced-motion`

### 4.3 Surface Isolation

Client and Admin surfaces **must never**:

- Share cookies
- Share auth endpoints
- Render each other’s navigation
- Leak actor context across surfaces

---

## 5. Shared Information Architecture

### 5.1 Page Structure

All dashboard pages follow this structure:

1. Header
2. Primary Navigation
3. Main Content
   - Page title
   - Optional intro text
   - Content grid (cards)
4. Footer (minimal)

### 5.2 Card Grammar

All content is composed from **cards**.

A card may contain:
- Title
- Optional subtext
- Content body (placeholder, list, table, controls)
- Optional footer actions

Cards must feel:
- operational
- restrained
- non‑gamified

---

## 6. Routing & Entrypoints

### 6.1 Admin Surface

Routes:
- `/admin/login`
- `/admin/dashboard`
- `/admin/*` → surface‑scoped Not Found

Auth endpoints:
- `/api/admin/auth/login`
- `/api/admin/auth/logout`
- `/api/admin/auth/me`

Server registration:
- `registerAdminRoutes(router)`

---

### 6.2 Client Surface

Routes:
- `/client/login`
- `/client/dashboard`
- `/client/*` → surface‑scoped Not Found

Auth endpoints:
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`

Server registration:
- `registerClientRoutes(router)`

---

## 7. App Shell Specifications

### 7.1 Shared Header Requirements

Header must include:
- Brand mark
- Surface label (Client / Admin)
- Skip‑to‑content link
- Account menu placeholder
- Logout control (wired)

### 7.2 Admin Navigation (Placeholders Allowed)

- Dashboard
- Clients
- Orders
- Menu
- Deliveries
- Support / Chat
- Audit Log
- Settings

### 7.3 Client Navigation (Placeholders Allowed)

- Dashboard
- Order Menu
- Packs / Subscription
- Deliveries
- Payments / History
- Favourites
- Support
- Profile

---

## 8. Dashboard Home Layout (Bento Grid)

Both dashboards use a **responsive bento‑style grid** composed of cards.

### 8.1 Grid Principles

- One grid container per page
- Cards span columns/rows to create rhythm
- No cramped multi‑column layouts on mobile
- Neutral surfaces; no decorative color blocks

### 8.2 Breakpoints (Token‑Driven)

- Mobile: 1 column (stacked)
- Tablet: 2 columns
- Desktop: 3–4 columns

### 8.3 Card Span Conventions

- Wide cards: primary operational blocks
- Single cards: secondary or status blocks
- Debug card: always last, visually muted

---

## 9. Home Page Placeholder Blocks

### 9.1 Admin Dashboard

Typical blocks:
- Overview KPIs (wide)
- Operational queue (wide)
- Quick actions (single)
- Recent activity / audit preview (wide)
- Debug panel (single, dev‑only)

### 9.2 Client Dashboard

Typical blocks:
- Pack / credits balance (wide)
- Next delivery (single)
- This week’s menu (wide)
- Recent orders (wide)
- Subscription / plan (single)
- Support (single)
- Debug panel (single, dev‑only)

---

## 10. Authentication UX Scaffold

### 10.1 Bootstrap Flow

On app start:
1. Call `/me`
2. If unauthenticated → redirect to login
3. If wrong actor type → logout → redirect
4. In dev: render actor JSON in Debug panel

### 10.2 Messaging Rules

- Login pages show no error until submit fails
- Success/info messages appear above primary action
- Dashboard messages clear on navigation

---

## 11. Feature Integration Stubs

Every future module must integrate via placeholders:

- Placeholder page
- Placeholder API client
- Placeholder server route (BalanceGuard‑wrapped)
- Optional home‑page block

Example:
- `src/frontend/admin/pages/orders/page.ts`
- `src/server/http/routes/admin.orders.routes.ts`
- `src/modules/orders/**`

---

## 12. Minimal Scaffold Tests

Required tests:

- Admin routes reject client sessions
- Client routes reject admin sessions
- `/me` returns correct actor per cookie
- Logout enforces correct surface
- Cookie isolation verified

UI testing deferred until scaffold stabilises.

---

## 13. Token Usage Reference

Dashboards must exclusively use tokens for:
- spacing (`--bk-space-*`)
- colors (`--bk-color-*`)
- borders (`--bk-border-*`)
- radii (`--bk-radius-*`)
- shadows (`--bk-shadow-*`)
- typography (`--bk-font-*`)

Focus rings must use the shared focus token.

---

## 14. Change Log

- v2: Full refactor for clarity, surface separation, and build‑order readiness
- v1: Initial scaffold UX specification

