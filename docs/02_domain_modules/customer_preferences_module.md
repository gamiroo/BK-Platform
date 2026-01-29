# customer_preferences_module.md — Customer Preferences Module (v1.0)
Referenced by balance.md
> **Canonical Customer Preferences module specification** for Balance Kitchen (BK).
>
> This module owns **customer-specific preference data** used to personalize menus, ordering, and delivery experience, including:
>
> - Dietary style / plan (e.g., high-protein, calorie target)
> - Allergens and exclusions
> - Ingredient likes & dislikes
> - Preference “profiles” (e.g., *Cutting*, *Maintenance*, *Performance*)
> - Menu personalization inputs and outputs (preference scoring signals)
>
> This module **does not** own orders, payments, subscriptions, or favourites.
>
> **DDD boundary rule:** All preference invariants live here; transports remain thin.

---

## 0. Status

## 0.1 At a Glance

- **Purpose**: Store and evaluate customer dietary preferences for personalization
- **Key Features**: Profiles, rules (allergens/exclusions/likes), meal compatibility
- **Security**: PII protection, audit trails, strict authz
- **Future**: Recommendation scoring, profile scheduling

- Version: **v1.0**
- Designed for: **BK initial production**
- Future-friendly: supports multiple profiles per user, soft-delete, audit events, and deterministic validation.

---

## 1. Purpose

Customer preferences are required to:

1. Personalize the weekly menu (highlight suitable meals; reduce friction).
2. Prevent ordering mistakes (e.g., allergen/exclusion mismatch warnings).
3. Provide account managers with a clear view of customer constraints.
4. Enable future recommendation features (ranking, meal suggestions) without changing foundational storage.

---

## 2. Scope

### 2.1 In scope

- Preference profiles per **account + user** (and optionally per account without a specific user).
- Rules:
  - allergens (hard block)
  - exclusions (hard block)
  - dislikes (soft negative)
  - likes (soft positive)
- Dietary plan metadata:
  - plan type
  - calorie target range (optional)
  - macro targets (optional)
  - notes for account managers
- Validation rules and normalization (canonical ingredient keys, consistent casing).
- Safe read models for:
  - menu filtering
  - “suitability” flags
  - warning summaries

### 2.2 Out of scope

- **Orders & order history** (belongs to ordering module).
- **Favourites** (belongs to favourites module).
- **Meal catalog** (menu module).
- **Medical advice**. BK stores preferences as user-provided constraints only.

---

## 3. Concepts & Terminology

### 3.1 Preference Profile
A named preference set used for personalization.

Examples:
- “Default”
- “Cutting”
- “Low FODMAP (trial)”

A profile can be:
- **User-scoped:** tied to a specific `identity_users.id`
- **Account-scoped:** tied only to `accounts_accounts.id` (useful when multiple household users share ordering)

### 3.1.1 Profile Scoping Rules

- **User-scoped profile**
  - `account_id` is set
  - `user_id` is set
- **Account-scoped profile**
  - `account_id` is set
  - `user_id` is `NULL`

Access rules:

- A customer may access:
  - Their own user-scoped profiles
  - Account-scoped profiles for their account
- An admin may access:
  - All profiles within their authorized accounts


### 3.2 Rule Types

- **ALLERGEN**: hard block, highest severity.
- **EXCLUSION**: hard block.
- **DISLIKE**: soft negative.
- **LIKE**: soft positive.

### 3.3 Ingredient Key
A canonical, stable identifier used for rules.

- Stored as a **normalized token** (e.g., `"milk"`, `"peanut"`, `"coriander"`).
- UI may show display labels, but storage uses normalized keys.

---

## 4. Module Responsibilities

This module owns:

- Domain invariants:
  - rule uniqueness per profile
  - severity ordering
  - maximum sizes and normalization
- Application use-cases:
  - create/update a profile
  - set active profile
  - upsert rules
  - compute compatibility result between a profile and a meal ingredient set
- Infrastructure adapters:
  - DB persistence
  - read models (materialized JSON payload for UI)
- Transport bindings:
  - HTTP routes for client/admin surfaces

---

## 5. Data Classification & Sensitivity

Preference data can be **sensitive** (e.g., allergens). Treat it as:

- **Confidential customer data**
- Restricted to:
  - the customer
  - authorized account managers / admins

Rules:

- Never log raw preference payloads.
- Redact ingredient lists in security logs.
- Provide audit events for staff-driven changes.

## 5.1 Configuration Constants

All limits are configurable and sourced from `shared/config/env.ts`.

- `PREFERENCES_MAX_PROFILES_PER_SCOPE` (default: 5)
- `PREFERENCES_MAX_RULES_PER_PROFILE` (default: 150)
- `PREFERENCES_MAX_NOTES_LENGTH` (default: 1024)
- `PREFERENCES_MAX_FREE_TEXT_NOTES` (default: 512)
- `PREFERENCES_INGREDIENT_KEY_MAX_LENGTH` (default: 50)

---

## 6. Database Schema (Proposed)

> **Note:** These tables are introduced by this module and must be added to the canonical schema document and migrations.

### 6.1 preferences_profiles

Stores preference profiles.

Columns:

- `id` (uuid, pk)
- `account_id` (uuid, fk → accounts_accounts.id)
- `user_id` (uuid, nullable, fk → identity_users.id)
- `name` (text)
- `status` (text) — `ACTIVE` | `ARCHIVED`
- `is_default` (boolean) — only one `true` per (`account_id`,`user_id` nullable-safe)
- `dietary_plan` (jsonb) — plan metadata (see 6.4)
- `notes` (text, nullable) — staff/customer notes (plain text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

Indexes:

- `idx_preferences_profiles__account_id`
- `idx_preferences_profiles__user_id`
- `uq_preferences_profiles__default_per_scope` (partial unique on default per scope)

### 6.2 preferences_rules

Stores ingredient rules per profile.

Columns:

- `id` (uuid, pk)
- `profile_id` (uuid, fk → preferences_profiles.id)
- `kind` (text) — `ALLERGEN` | `EXCLUSION` | `DISLIKE` | `LIKE`
- `ingredient_key` (text)
- `source` (text) — `CUSTOMER` | `ADMIN`
- `created_at` (timestamptz)

Constraints:

- Unique: (`profile_id`, `kind`, `ingredient_key`)
- Check: `ingredient_key` matches normalization policy (lowercase, dash/underscore allowed)

Indexes:

- `idx_preferences_rules__profile_id`
- `idx_preferences_rules__ingredient_key`

### 6.3 preferences_events

Audit trail for changes.

Columns:

- `id` (uuid, pk)
- `account_id` (uuid, fk → accounts_accounts.id)
- `user_id` (uuid, nullable, fk → identity_users.id) — actor user (if authenticated)
- `profile_id` (uuid, nullable, fk → preferences_profiles.id)
- `event_type` (text)
- `payload_redacted` (jsonb, nullable)
- `request_id` (uuid)
- `ip` (text, nullable)
- `created_at` (timestamptz)

Indexes:

- `idx_preferences_events__account_id`
- `idx_preferences_events__profile_id`
- `idx_preferences_events__created_at`

### 6.4 dietary_plan JSON shape (stored in preferences_profiles.dietary_plan)

Stored JSON must be deterministic (stable keys, no arbitrary nesting).

```json
{
  "plan_type": "HIGH_PROTEIN",
  "calories": { "min": 1800, "max": 2200 },
  "macros": {
    "protein_g": 180,
    "carbs_g": 160,
    "fat_g": 60
  },
  "tags": ["CUTTING"],
  "free_text_notes": "No spicy meals please"
}
```

#### 6.4.1 Dietary Plan Validation Rules

- `plan_type`: Must be one of: `STANDARD`, `HIGH_PROTEIN`, `LOW_CARB`, `KETO`, `VEGETARIAN`, `VEGAN`, `CUSTOM`
- `calories.min/max`: Integer, 0-10000, min ≤ max
- `macros.*_g`: Integer, 0-1000
- `tags`: Array of max 10 strings, each ≤ 50 chars
- `free_text_notes`: Max 512 chars, plain text only


---

## 7. Domain Rules & Invariants

### 7.1 Normalization

- `ingredient_key` is normalized:
  - trim
  - lowercase
  - collapse whitespace
  - replace spaces with `_`
  - remove unsupported characters

### 7.2 Limits (configurable)

- Max profiles per scope (account/user): **5**
- Max rules per profile: **150**
- Max notes length: **1024**
- Max dietary_plan.free_text_notes: **512**

### 7.3 Priority

When evaluating compatibility between a profile and meal ingredients:

- Any `ALLERGEN` match ⇒ **BLOCKED**
- Any `EXCLUSION` match ⇒ **BLOCKED**
- `DISLIKE` matches ⇒ **WARN** (soft negative)
- `LIKE` matches ⇒ **BOOST** (soft positive)

### 7.4 Soft Delete Pattern

- Preference profiles support soft deletion via `deleted_at`
- Soft-deleted profiles are excluded from normal queries
- Admins may view deleted profiles for audit and recovery
- Hard deletion only occurs via GDPR/compliance workflows

Note:
- Preference rules are removed via explicit domain actions and audited events,
  not soft deletion.


---

## 8. Application Use-Cases

### 8.1 CreateProfile

Inputs:
- `account_id`
- `user_id?`
- `name`
- `dietary_plan?`
- `notes?`

Behavior:
- Enforce max profiles
- If first profile for scope ⇒ `is_default=true`
- Write `preferences_events` entry

### 8.2 UpdateProfile

- Rename
- Update dietary_plan
- Update notes
- Archive/unarchive

### 8.3 SetDefaultProfile

- Ensure only one default profile per scope

### 8.4 UpsertRules

- Add/remove rules
- Enforce uniqueness and size limit
- Write audit event

### 8.5 EvaluateMealCompatibility

Inputs:
- `profile_id`
- `meal_ingredient_keys[]`

Outputs:
- `status`: `OK` | `WARN` | `BLOCKED`
- `matches`: { allergens[], exclusions[], dislikes[], likes[] }
- `score_hint` (optional) — a deterministic numeric hint for ranking

Compatibility evaluation returns a structured, explainable result:

```ts
type MealCompatibilityResult = {
  status: 'BLOCKED' | 'WARN' | 'OK';
  matches: {
    allergens: string[];
    exclusions: string[];
    dislikes: string[];
    likes: string[];
  };
  score_hint: number; // range: -100 to +100
  warnings: string[]; // human-readable explanations
};


---

## 9. Transport Surface (HTTP)

> All routes must be wrapped with BalanceGuard.

### 9.1 Client surface routes

- `GET /api/client/preferences/profiles`
  - list profiles for authenticated customer
- `POST /api/client/preferences/profiles`
  - create profile
- `PATCH /api/client/preferences/profiles/:profile_id`
  - update profile
- `POST /api/client/preferences/profiles/:profile_id/default`
  - set default profile
- `PUT /api/client/preferences/profiles/:profile_id/rules`
  - replace rules set (idempotent)

### 9.2 Admin surface routes

- `GET /api/admin/accounts/:account_id/preferences/profiles`
- `POST /api/admin/accounts/:account_id/preferences/profiles`
- `PATCH /api/admin/preferences/profiles/:profile_id`
- `PUT /api/admin/preferences/profiles/:profile_id/rules`

Admin routes must enforce:

- Role-based authorization
- Account scoping (admins cannot cross-tenant)

### 9.3 Public site routes

None.

---

## 10. Request / Response Shapes

### 10.1 Profile DTO

```ts
type PreferenceProfileDto = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  is_default: boolean;
  dietary_plan: {
    plan_type: string;
    calories?: { min: number; max: number };
    macros?: { protein_g?: number; carbs_g?: number; fat_g?: number };
    tags?: string[];
    free_text_notes?: string;
  } | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
```

### 10.2 Rules DTO

```ts
type PreferenceRuleDto = {
  kind: 'ALLERGEN' | 'EXCLUSION' | 'DISLIKE' | 'LIKE';
  ingredient_key: string;
  source: 'CUSTOMER' | 'ADMIN';
};
```

---

## 11. Security Requirements

### 11.1 Authentication

- Client routes require authenticated customer sessions.
- Admin routes require authenticated staff sessions.

### 11.2 Authorization

- Deny-by-default.
- Staff must be scoped to account.
- Customer can only access their own profile scope.

### 11.3 Rate limiting

- Apply per-route rate limits.
- Separate limits for write routes (stricter).

### 11.4 CSRF

- Required for unsafe methods on authenticated routes.

### 11.5 Logging and PII

- Log `request_id`, route, actor id, account id.
- Never log raw preference payloads.
- Store only redacted payload fragments in `preferences_events.payload_redacted`.

---

## 12. Error Handling (BalanceGuard-aligned)

BalanceGuard controls the public error response envelope and canonical `error.code`.

Canonical response codes (must be used):

- `AUTH_REQUIRED` (401)
- `FORBIDDEN` (403)
- `CSRF_INVALID` (403)
- `ORIGIN_INVALID` (403)
- `RATE_LIMITED` (429)
- `INPUT_INVALID` (400)
- `INTERNAL_ERROR` (500)

### 12.1 Preferences Error Reasons (Internal)

This module defines **internal reason codes** for domain decisions and auditing.
These reason codes:

- MUST NOT be returned as `error.code` in HTTP responses
- MAY be logged (redacted) and/or stored in `preferences_events.payload_redacted.reason`
- SHOULD be included in server logs alongside `request_id`

Internal reasons (recommended):

- `PREFERENCES_PROFILE_NOT_FOUND`
- `PREFERENCES_PROFILE_LIMIT_EXCEEDED`
- `PREFERENCES_RULE_LIMIT_EXCEEDED`
- `PREFERENCES_INVALID_INGREDIENT_KEY`
- `PREFERENCES_DUPLICATE_RULE`
- `PREFERENCES_PROFILE_ARCHIVED`
- `PREFERENCES_CROSS_TENANT_ACCESS_ATTEMPT`

### 12.2 Mapping: Domain reason → BalanceGuard response

When returning HTTP errors, map as follows:

| Domain reason                              | BalanceGuard `error.code` | Status | Public message (safe)                    |
|--------------------------------------------|----------------------------|--------|------------------------------------------|
| profile not found / archived / invalid id  | `INPUT_INVALID`            | 400    | \"Invalid profile\"                      |
| profile limit exceeded                      | `INPUT_INVALID`            | 400    | \"Profile limit exceeded\"               |
| rule limit exceeded                         | `INPUT_INVALID`            | 400    | \"Rule limit exceeded\"                  |
| invalid ingredient key                      | `INPUT_INVALID`            | 400    | \"Invalid ingredient key\"               |
| duplicate rule                              | `INPUT_INVALID`            | 400    | \"Duplicate rule\"                       |
| customer tries to access another scope      | `FORBIDDEN`                | 403    | \"Forbidden\"                             |
| unauthenticated access to client/admin      | `AUTH_REQUIRED`            | 401    | \"Authentication required\"              |
| CSRF failure                                | `CSRF_INVALID`             | 403    | \"CSRF token missing or invalid\"        |
| Origin allowlist failure                    | `ORIGIN_INVALID`           | 403    | \"Origin not allowed\"                   |
| rate limit triggered                        | `RATE_LIMITED`             | 429    | \"Too many requests\"                    |
| unexpected failures                          | `INTERNAL_ERROR`           | 500    | \"Unexpected server error\"              |

Note:
- Prefer returning `INPUT_INVALID` over `404` for profile access failures to reduce resource enumeration.
- Always include `request_id` in responses (BalanceGuard requirement).

---

## 13. Observability & Audit

### 13.1 Security events

Emit structured security logs for:

- unauthorized access attempts
- cross-tenant access attempts
- excessive write attempts (rate limit triggers)

For securityLogger events (transport/security layer), prefer the canonical BalanceGuard categories:

- auth failures (`AUTH_REQUIRED`, `FORBIDDEN`)
- CSRF failures (`CSRF_INVALID`)
- origin violations (`ORIGIN_INVALID`)
- rate limits (`RATE_LIMITED`)

If you add module-specific security events, namespace them:

- `security.preferences.cross_tenant_access_attempt`
- `security.preferences.excessive_mutation_attempt`


### 13.2 Preferences events

Every mutation produces a `preferences_events` row.

Suggested `event_type` values (namespaced, dotted):

- `preferences.profile.created`
- `preferences.profile.updated`
- `preferences.profile.archived`
- `preferences.profile.restored`
- `preferences.profile.default_set`
- `preferences.rules.replaced`
- `preferences.rule.added`
- `preferences.rule.removed`


```ts
type PreferenceEvent = {
  event_type: string; // e.g., "preferences.profile.updated"
  account_id: string;
  profile_id?: string;

  // BalanceGuard-aligned actor semantics:
  actor_kind: 'anonymous' | 'client' | 'admin' | 'account_manager' | 'super_admin' | 'system';
  actor_user_id?: string; // if authenticated

  // Safe-only payload:
  payload_redacted?: {
    reason?: string; // internal reason code, e.g. PREFERENCES_RULE_LIMIT_EXCEEDED
    rule_kind?: 'ALLERGEN' | 'EXCLUSION' | 'DISLIKE' | 'LIKE';
    ingredient_keys_count?: number;
    profile_status?: 'ACTIVE' | 'ARCHIVED';
  };

  request_id: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
};


---

## 14. Folder Layout (Module)

```
src/modules/preferences/
  domain/
    entities/
      preference-profile.ts
      preference-rule.ts
    value-objects/
      ingredient-key.ts
      dietary-plan.ts
    invariants/
      limits.ts
    services/
      evaluate-meal-compatibility.ts
  app/
    use-cases/
      create-profile.ts
      update-profile.ts
      set-default-profile.ts
      replace-rules.ts
      evaluate-meal-compatibility.ts
  infra/
    db/
      preferences.repo.ts
      preferences.queries.ts
  transport/
    http/
      client/
        routes.ts
      admin/
        routes.ts
      dtos.ts
```

---

## 15. Testing Requirements

Tests live under `/tests/**`.

### 15.1 Domain tests

- ingredient normalization
- rule uniqueness
- limit enforcement
- compatibility evaluation correctness

### 15.2 HTTP route tests

- BalanceGuard headers applied
- auth required for client/admin routes
- authz denies cross-tenant
- rate limiting enforced

---

## 16. Performance Considerations

- Profile lookups must use indexed queries
- Compatibility evaluation must be deterministic and cacheable
- Read-heavy paths may use read replicas
- Batch operations are preferred for large rule updates

---

## 17. Migration Plan

1. Schema migration: tables, indexes, constraints
2. Core logic: domain entities, use-cases, repositories
3. Transport layer: HTTP endpoints wrapped in BalanceGuard
4. Audit logging: structured preference events
5. Backfill strategy:
   - Create default profile for existing customers
   - Migrate legacy preference data if present
6. Testing: unit, integration, authz
7. Monitoring: logs, rate limits, error metrics
8. UI integration: client dashboard and admin tooling

---

## 18. Future Extensions

- Profile scheduling (different preferences by day/week)
- Auto-generated profiles based on order history
- Recommendation scoring model (deterministic + explainable)
- “Household profiles” (multiple user_ids per account-scoped profile)
- Ingredient taxonomy integration (synonyms; e.g., `"chilli"` vs `"chili"`)

---

## 19. Non-Negotiables

- Domain rules live in this module.
- Transports are thin.
- BalanceGuard wraps all HTTP routes.
- No raw preference payloads in logs.

---

## 20. Data Retention & Compliance

- Preference data is retained for the lifetime of an active account
- Upon account deletion:
  - Soft delete immediately
  - Hard delete after `PREFERENCES_RETENTION_DAYS` (default: 30)
- Audit events are retained for a minimum of 2 years
- GDPR right-to-erasure triggers immediate hard deletion of all preference data

---

## 21. API Versioning

API routes may optionally use version prefixes:

- `/api/v1/client/preferences/...`
- `/api/v1/admin/preferences/...`

Versioning policy:

- Backward-compatible changes remain in the same version
- Breaking changes require a new major version
- Deprecation notice period: minimum 6 months
