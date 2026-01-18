# Balance Kitchen — Security Responsibility Matrix

> **Purpose**  
> This matrix defines **clear ownership of security responsibilities** across the Balance Kitchen (BK) platform.  
> It exists to remove ambiguity between **application code**, **infrastructure**, **CI/CD**, and **organizational controls**.

This document is **descriptive, not prescriptive**. It does **not** introduce new requirements; it clarifies responsibility boundaries already implied by the system architecture.

This matrix must be read alongside:
- `balance.md`
- `balanceguard.md`
- `balanceguard_structure.md`
- `balance_kitchen_architecture.md`
- `balance_kitchen_toolkit.md`
- `balance_kitchen_schema.md`

---

## Responsibility Domains

| Domain | Description |
|---|---|
| **Application (BK Codebase)** | Runtime security enforced directly by Balance Kitchen code (BalanceGuard, WSGuard, schema constraints) |
| **Infrastructure / Platform** | Cloud provider, networking, TLS, database hosting, backups |
| **CI/CD & Tooling** | Build‑time security, dependency analysis, static analysis |
| **Organization / Operations** | Human access, policies, devices, training |

---

## 1. Identity, Authentication & Authorization

| Control | Application (BK) | Infrastructure | CI/CD | Org / Ops |
|---|---|---|---|---|
| User authentication | ✅ Server‑side sessions | ❌ | ❌ | ❌ |
| Session storage | ✅ `identity_sessions` | ❌ | ❌ | ❌ |
| Session expiry & rotation | ✅ BalanceGuard | ❌ | ❌ | ❌ |
| RBAC authorization | ✅ Deny‑by‑default | ❌ | ❌ | ❌ |
| MFA capability | ✅ Architecture‑ready | ❌ | ❌ | ⚠️ Policy |
| Admin access control | ✅ Roles + guards | ❌ | ❌ | ❌ |
| Staff IAM | ❌ | ⚠️ Cloud IAM | ❌ | ✅ |

---

## 2. Input Validation & Abuse Prevention

| Control | Application (BK) | Infrastructure | CI/CD | Org / Ops |
|---|---|---|---|---|
| Input validation | ✅ Validation toolkit | ❌ | ❌ | ❌ |
| Body size limits | ✅ Per‑route | ❌ | ❌ | ❌ |
| SQL injection prevention | ✅ ORM + no raw SQL | ❌ | ❌ | ❌ |
| HTTP rate limiting | ✅ BalanceGuard | ❌ | ❌ | ❌ |
| WebSocket rate limiting | ✅ WSGuard | ❌ | ❌ | ❌ |
| Abuse throttling | ✅ IP / actor keys | ❌ | ❌ | ❌ |

---

## 3. Session, Cookies & Browser Security

| Control | Application (BK) | Infrastructure | CI/CD | Org / Ops |
|---|---|---|---|---|
| HttpOnly cookies | ✅ Enforced | ❌ | ❌ | ❌ |
| Secure cookies (HTTPS) | ✅ Required | ⚠️ TLS termination | ❌ | ❌ |
| SameSite policy | ✅ Explicit | ❌ | ❌ | ❌ |
| CSRF protection | ✅ Double‑submit | ❌ | ❌ | ❌ |
| Origin enforcement | ✅ BalanceGuard | ❌ | ❌ | ❌ |
| CORS allowlists | ✅ Explicit | ❌ | ❌ | ❌ |

---

## 4. Data Protection & Storage

| Control | Application (BK) | Infrastructure | CI/CD | Org / Ops |
|---|---|---|---|---|
| PII identification | ✅ Schema‑aware | ❌ | ❌ | ❌ |
| Password hashing | ✅ Server‑side | ❌ | ❌ | ❌ |
| Session token hashing | ✅ Mandatory | ❌ | ❌ | ❌ |
| Encryption in transit | ❌ | ✅ TLS | ❌ | ❌ |
| Encryption at rest | ❌ | ✅ Disk / DB | ❌ | ❌ |
| Key management (KMS/HSM) | ❌ | ✅ Platform | ❌ | ❌ |
| Backups & recovery | ❌ | ✅ Platform | ❌ | ❌ |

> **Note**  
> Balance Kitchen intentionally avoids implementing custom cryptography or key storage. This is a deliberate risk‑reduction decision.

---

## 5. Database & Network Security

| Control | Application (BK) | Infrastructure | CI/CD | Org / Ops |
|---|---|---|---|---|
| DB access via app only | ❌ | ✅ Network rules | ❌ | ❌ |
| No public DB ports | ❌ | ✅ Firewalls | ❌ | ❌ |
| Connection pooling | ✅ DB client | ❌ | ❌ | ❌ |
| Credential handling | ✅ `env.ts` only | ❌ | ❌ | ❌ |

---

## 6. Error Handling & Information Disclosure

| Control | Application (BK) | Infrastructure | CI/CD | Org / Ops |
|---|---|---|---|---|
| Generic user errors | ✅ Normalized | ❌ | ❌ | ❌ |
| No stack traces in prod | ✅ Guaranteed | ❌ | ❌ | ❌ |
| Canonical error codes | ✅ Enforced | ❌ | ❌ | ❌ |
| Sensitive data redaction | ✅ Mandatory | ❌ | ❌ | ❌ |

---

## 7. Logging, Monitoring & Auditing

| Control | Application (BK) | Infrastructure | CI/CD | Org / Ops |
|---|---|---|---|---|
| Request correlation | ✅ `request_id` | ❌ | ❌ | ❌ |
| Security event logs | ✅ Explicit | ❌ | ❌ | ❌ |
| Log redaction | ✅ Enforced | ❌ | ❌ | ❌ |
| Log storage & retention | ❌ | ⚠️ Platform | ❌ | ⚠️ Policy |
| Alerting / SIEM | ❌ | ⚠️ Platform | ❌ | ⚠️ Ops |

---

## 8. Webhooks & Third‑Party Integrations

| Control | Application (BK) | Infrastructure | CI/CD | Org / Ops |
|---|---|---|---|---|
| Webhook signature verification | ✅ Mandatory | ❌ | ❌ | ❌ |
| Idempotency handling | ✅ Required | ❌ | ❌ | ❌ |
| Raw payload protection | ✅ Never logged | ❌ | ❌ | ❌ |
| Provider secret storage | ❌ | ⚠️ Secrets manager | ❌ | ❌ |

---

## 9. CI/CD & Supply‑Chain Security

| Control | Application (BK) | Infrastructure | CI/CD | Org / Ops |
|---|---|---|---|---|
| Static analysis (SAST) | ❌ | ❌ | ⚠️ Required | ❌ |
| Dependency CVE scanning | ❌ | ❌ | ⚠️ Required | ❌ |
| Secret scanning | ❌ | ❌ | ⚠️ Required | ❌ |
| Quality gates | ❌ | ❌ | ⚠️ Required | ❌ |

---

## 10. Developer & Organizational Security

| Control | Application (BK) | Infrastructure | CI/CD | Org / Ops |
|---|---|---|---|---|
| Developer RBAC | ❌ | ⚠️ IAM | ❌ | ✅ |
| VPN access | ❌ | ⚠️ Network | ❌ | ✅ |
| Endpoint protection | ❌ | ❌ | ❌ | ✅ |
| Security training | ❌ | ❌ | ❌ | ✅ |

---

## Explicit Non‑Goals (By Design)

Balance Kitchen **does not**:
- Implement client‑side encryption
- Store or rotate cryptographic keys
- Replace cloud IAM or network security
- Manage VPNs or developer devices
- Embed security scanners into runtime code

These exclusions are **intentional** and aligned with modern secure‑by‑design systems.

---

## Final Summary

- **BalanceGuard owns runtime application security**
- **Infrastructure owns encryption, networking, and backups**
- **CI/CD owns supply‑chain and static analysis**
- **Organization owns human access and policy**

This separation ensures:
- Minimal attack surface
- Clear accountability
- Audit readiness
- Long‑term maintainability

