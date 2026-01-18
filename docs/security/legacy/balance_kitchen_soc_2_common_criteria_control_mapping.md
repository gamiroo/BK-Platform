# Balance Kitchen — SOC 2 (Common Criteria) Control Mapping

> **Purpose**  
> This document maps the existing Balance Kitchen (BK) security architecture to **SOC 2 Common Criteria (CC)** controls.  
> It is intended to support:
> - Enterprise security questionnaires
> - Pre-SOC readiness
> - Auditor and stakeholder reviews
>
> This document does **not** introduce new controls or requirements. It describes **how existing BK controls satisfy SOC 2 expectations**.

This mapping must be read alongside:
- `balance.md`
- `balanceguard.md`
- `balanceguard_structure.md`
- `balance_kitchen_architecture.md`
- `balance_kitchen_toolkit.md`
- **Security Responsibility Matrix**

---

## Scope & Assumptions

- Scope: **SOC 2 — Common Criteria (CC1–CC9)**
- Trust principles explicitly covered:
  - Security (Primary)
  - Availability (Partial)
  - Confidentiality (Partial)
- Infrastructure-level controls (TLS, disk encryption, firewalls) are **explicitly owned by the platform provider** and referenced as such.

---

## CC1 — Control Environment

| SOC Control | Description | BK Implementation | Evidence |
|---|---|---|---|
| CC1.1 | Commitment to integrity and ethical values | Security-first architecture; deny-by-default model | `balance.md` §3, §11 |
| CC1.2 | Oversight responsibility | Canonical documentation governs all changes | `balance.md` Governance |
| CC1.3 | Organizational structure | Explicit separation: app / infra / CI / ops | Security Responsibility Matrix |

---

## CC2 — Communication & Information

| SOC Control | Description | BK Implementation | Evidence |
|---|---|---|---|
| CC2.1 | Internal communication of security objectives | Canonical docs as source of truth | All core BK docs |
| CC2.2 | External communication | Generic error responses; no internal leakage | `balanceguard.md` §13 |

---

## CC3 — Risk Assessment

| SOC Control | Description | BK Implementation | Evidence |
|---|---|---|---|
| CC3.1 | Risk identification | Threat model documented | `balanceguard.md` §2 |
| CC3.2 | Risk analysis | Explicit non-goals + scoped controls | Security Responsibility Matrix |
| CC3.3 | Risk mitigation | Layered controls (edge + domain) | `balanceguard.md`, architecture |

---

## CC4 — Monitoring Activities

| SOC Control | Description | BK Implementation | Evidence |
|---|---|---|---|
| CC4.1 | Monitoring for deviations | Structured request + security logs | `security-logger.ts` |
| CC4.2 | Evaluation of controls | Tests + doc-driven enforcement | `balanceguard_compliance_routes.md` |

---

## CC5 — Control Activities

| SOC Control | Description | BK Implementation | Evidence |
|---|---|---|---|
| CC5.1 | Logical access controls | RBAC via BalanceGuard | `balanceguard.md` §5 |
| CC5.2 | Segregation of duties | DDD boundaries enforced | `balance_kitchen_architecture.md` |
| CC5.3 | Change controls | Versioned code + docs | Repo governance |

---

## CC6 — Logical & Physical Access Controls

| SOC Control | Description | BK Implementation | Evidence |
|---|---|---|---|
| CC6.1 | Logical access restriction | Deny-by-default RBAC | `balanceguard/authz.ts` |
| CC6.2 | Authentication prior to access | Server-side sessions | `identity_sessions` schema |
| CC6.3 | Session termination | Idle + absolute expiry | `sessions.ts` |
| CC6.6 | Privileged access | Explicit admin roles | `identity_roles` |

---

## CC7 — System Operations

| SOC Control | Description | BK Implementation | Evidence |
|---|---|---|---|
| CC7.1 | System monitoring | Request + event logging | Logging toolkit |
| CC7.2 | Anomaly detection | Rate-limit + auth failures logged | `balanceguard.md` §14 |
| CC7.3 | Incident response | Structured logs + request IDs | Security Responsibility Matrix |

---

## CC8 — Change Management

| SOC Control | Description | BK Implementation | Evidence |
|---|---|---|---|
| CC8.1 | Authorized changes | Code + doc governance | `balance.md` §11 |
| CC8.2 | Change testing | Required test coverage | `tests/**` |

---

## CC9 — Risk Mitigation

| SOC Control | Description | BK Implementation | Evidence |
|---|---|---|---|
| CC9.1 | Risk mitigation activities | Rate limiting, CSRF, origin checks | `balanceguard.md` |
| CC9.2 | Vendor & third-party risk | Stripe via signature-verified webhooks | Stripe toolkit |

---

## Explicit Out-of-Scope (SOC Perspective)

The following controls are **intentionally handled outside the BK application**:

- Physical security
- Network firewalls
- TLS certificate management
- Disk / database encryption
- Backups and disaster recovery
- Developer endpoint security
- VPN enforcement

These are owned by **infrastructure providers or organizational policy** and are documented in the Security Responsibility Matrix.

---

## Executive Summary (Auditor-Facing)

Balance Kitchen satisfies the intent of SOC 2 Common Criteria through:

- Centralized security enforcement (BalanceGuard / WSGuard)
- Deny-by-default authorization
- Server-side session management
- Comprehensive request and security logging
- Explicit separation of application, infrastructure, and organizational responsibilities

No ad-hoc security logic exists outside the defined toolkit. All enforcement points are documented, testable, and auditable.

---

## Notes

This document is designed to be:
- **Pre-audit ready**
- **Low-bureaucracy**
- **Aligned with engineering reality**

It can be extended to Availability or Confidentiality trust principles without architectural change.
