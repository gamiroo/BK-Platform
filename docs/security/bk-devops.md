# devops_setup.md — DevOps, Trunk‑Based Development, Versioning & CI/CD (v1.0)

> **Canonical DevOps specification** for Balance Kitchen (BK).
>
> Defines:
>
> - trunk‑based development workflow
> - versioning and release management
> - CI quality gates
> - CD deployment pipeline
> - environments, secrets, migrations
> - operational safety (backups, monitoring, incident response)
>
> This document is designed to be **implementation-ready** and compatible with BK’s enforcement rules:
>
> - thin adapters, DDD modules (`balance_kitchen_architecture.md`)
> - BalanceGuard on every route (`balanceguard.md`)
> - token-driven UI rules (`balance_kitchen_tokens.md`, if present)
> - docs-as-source-of-truth (`balance.md`)

---

## 0. Status & Scope

**Status:** Proposed (v1.0)

**Scope:**

- Git workflow and branch strategy
- Release and versioning policy
- CI/CD pipeline gates
- Environment management
- Database migration discipline
- Observability and operational controls

**Out of scope:**

- Vendor-specific hosting details unless selected (this doc provides vendor-agnostic defaults)

---

## 1. Git Workflow — Trunk‑Based Development (TBD)

### 1.1 Branch Model

- `main` is the **single trunk**.
- All work lands on `main` via **short‑lived branches**.

Allowed branch types:

- `feat/<topic>` — feature work
- `fix/<topic>` — bug fixes
- `chore/<topic>` — tooling/refactor/docs
- `hotfix/<topic>` — emergency production fixes

Rules:

- Branch lifetime target: **< 2 days**
- Merge method: **squash merge** (single commit to trunk)
- No long-lived `develop` branch

### 1.2 Pull Request Requirements

Every PR must:

- be small and reviewable
- include tests (or explicit reason why not)
- update docs when required by governance rules
- pass all CI gates

### 1.3 Feature Flags (Preferred)

When work cannot ship end-to-end:

- use **feature flags** (server-enforced)
- default off
- remove flags within 30 days

Feature flags are preferred over long-lived branches.

---

## 2. Versioning & Release Management

### 2.1 Semantic Versioning

Use **SemVer** for platform releases:

- **MAJOR**: breaking API/contract change
- **MINOR**: backwards-compatible feature
- **PATCH**: bug fix

### 2.2 Repo Version Source of Truth

- `package.json` contains the canonical `version`.
- Every release tags `main` with `vX.Y.Z`.

### 2.3 Changelog

Maintain `CHANGELOG.md` using Keep a Changelog format:

- `Unreleased`
- versioned sections with date

Automatable via conventional commits, but not required.

### 2.4 Release Trains (Recommended)

- Release to **staging** continuously from `main`.
- Release to **production** on demand via a versioned tag.

---

## 3. Environments

### 3.1 Environment Tiers

Minimum tiers:

- `local` — developer machines
- `staging` — production-like, safe test
- `production` — customer-facing

Optional:

- `preview` — per-PR ephemeral deployments

### 3.2 Environment Parity

Rules:

- staging must mirror production configuration **as closely as possible**
- only data differs

### 3.3 Config & Secrets

Rules:

- all env access routed through `shared/config/env.ts`
- secrets stored only in a secrets manager / CI secret store
- never commit `.env` files
- rotate secrets on staff changes and incidents

### 3.4 Database Environment Strategy (Neon)

Balance Kitchen uses **Neon (PostgreSQL)** with explicit environment branching.

Branches:

- `main` → Production database
- `dev` → Development database (forked from `main`)

Rules:

- Neon branches are independent after creation
- Development data must never be derived from production after initial fork
- Production credentials are never used locally

### 3.4.1 Environment Variable Contract

The application consumes a **single database variable**:

- `DATABASE_URL`

Rules:

- Application code must never reference environment-specific variants
- Environment mapping is handled exclusively by the deployment platform
- Local development uses `.env.local`
- CI and Vercel inject environment-specific values at runtime

### 3.4.2 Vercel Integration

Vercel environments map as follows:

| Vercel Environment | Neon Branch |
| ------------------ | ----------- |
| Development        | `dev`       |
| Preview            | `dev`       |
| Production         | `main`      |

Disconnecting Neon’s automatic integration is required to preserve
explicit control over environment isolation.

### 3.4.3 Local Development Rules

- `.env.local` is required for local development
- `.env` may exist for tooling defaults but must not contain secrets
- `.env.local` is excluded from version control

This guarantees local safety while maintaining production parity.

---

## 4. CI Quality Gates (Mandatory)

CI runs on:

- every PR
- every push to `main`

### 4.1 Required Gates

1. **Install**
   - `pnpm install --frozen-lockfile`

2. **Typecheck**
   - `pnpm typecheck`

3. **Lint**
   - `pnpm lint`

4. **Unit + Integration Tests**
   - `pnpm test`

5. **Build**
   - `pnpm build`

### 4.2 Security Gates (Strongly Recommended)

- Dependency audit:
  - `pnpm audit --prod`
- Secret scanning:
  - gitleaks or equivalent
- SAST:
  - semgrep (ruleset tuned for TS/Node)

### 4.3 BalanceGuard Compliance Gate

Add a repo-level compliance check that fails CI if:

- any HTTP route is added/modified without BalanceGuard wrapper
- any route lacks required security headers application

Implementation options:

- static scan of route files
- unit tests covering route wrappers

This is a **hard gate**.

---

## 5. CD — Deployment Pipeline

### 5.1 Staging Deployment

Triggered by:

- merge to `main`

Steps:

1. Build artifact
2. Run DB migrations (staging)
3. Deploy services
4. Run smoke tests
5. Mark deployment status

### 5.2 Production Deployment

Triggered by:

- pushing a tag: `vX.Y.Z`

Steps:

1. Build artifact from tagged commit
2. Run DB migrations (production)
3. Deploy services
4. Run smoke tests
5. Enable feature flags (if applicable)
6. Post-deploy monitoring window

### 5.3 Rollback Strategy

Rollback is two-part:

- **App rollback**: redeploy previous tag
- **DB rollback**: avoid destructive migrations; use forward-fix migrations

Rule:

- migrations must be **backwards-compatible** for at least one release window

---

## 6. Database Migration Discipline

### 6.1 Migration Rules

- use timestamped migrations (monotonic)
- never edit a migration once merged to `main`
- every schema change requires:
  - migration
  - update to `balance_kitchen_schema.md`

### 6.2 Safe Migration Patterns

Preferred patterns:

- additive columns first
- dual-write / backfill
- switch reads
- remove old columns later

Avoid:

- dropping columns in the same release
- lock-heavy operations in peak windows

### 6.3 Migration Execution

- staging migrations run automatically on deploy
- production migrations run automatically on tag deploy

Migrations are executed with:

- explicit logs
- idempotency
- failure alerts

---

## 7. Observability & Operations

### 7.1 Logging

- structured logs only (Pino)
- include `request_id`
- redact secrets and sensitive data

### 7.2 Metrics (Recommended)

Minimum metrics:

- request rate / latency
- error rate
- rate limit triggers
- webhook processing success/failure
- DB connection pool health

### 7.3 Tracing (Optional)

- OpenTelemetry tracing (later) for complex debugging

### 7.4 Alerting

Alerts must exist for:

- elevated 5xx rate
- failed deployments
- failed migrations
- Stripe webhook failure spikes
- rate limit anomalies (possible abuse)

---

## 8. Backups, Recovery, and Data Retention

### 8.1 Backups

- automated daily backups (minimum)
- retention:
  - staging: 7–14 days
  - production: 30–90 days

### 8.2 Recovery Drills

- quarterly restore drill to validate backup integrity

### 8.3 Data Retention

- align retention for logs and audit events with compliance policy
- never log chat bodies

---

## 9. Access Control & Least Privilege

- separate credentials per environment
- database users are least-privilege
- production access requires MFA
- break-glass admin process for emergencies

---

## 10. Supply Chain Security

- lock dependencies with `pnpm-lock.yaml`
- verify CI runners
- signed tags (recommended)
- restrict who can create releases

---

## 11. Reference CI/CD Workflow (Template)

This section describes the *logical* pipeline; implement in GitHub Actions, GitLab CI, or another runner.

### 11.1 PR Pipeline

- checkout
- install
- typecheck
- lint
- test
- build
- security scans

### 11.2 Trunk (main) Pipeline

- all PR steps
- deploy to staging
- run smoke tests

### 11.3 Release Tag Pipeline

- all PR steps
- deploy to production
- run smoke tests
- open release notes (from changelog)

---

## 12. Definition of Done (DevOps)

A change is complete only when:

- CI gates pass
- BalanceGuard compliance passes
- migrations (if any) are safe and applied
- docs updated when required
- deployment and smoke tests succeed

---

## 13. Final Statement

This DevOps model exists to ensure:

- fast iteration without chaos
- strong security posture
- predictable releases
- safe database evolution

BK ships continuously, safely, and auditable-by-default.
