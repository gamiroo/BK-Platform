# chat_module.md — Chat Module (v1.2)
Referenced by balance.md
> **Canonical Chat module specification** for Balance Kitchen (BK).
>
> This module owns BK’s messaging workflows across surfaces:
>
> - **Site chat widget** (public / anonymous)
> - **Client dashboard chat** (authenticated)
> - **Admin dashboard chat** (authenticated staff)
>
> Chat is structured for scalability and future features:
>
> - **Main Lobby** (global)
> - **Sub-lobbies** (per account manager + their customers)
> - **Rooms** (organizational units within a lobby)
> - **Invites** (admin/moderator-controlled access)
>
> **Secure Chat Mode** (end-to-end encryption / client-side cryptography) is **explicitly deferred** and will be introduced later as a **separate subsystem**.

Related documents:

- `balance.md`
- `balance_kitchen_architecture.md`
- `balanceguard.md`
- `balanceguard_structure.md`
- `balance_kitchen_toolkit.md`
- `balance_kitchen_schema.md`

---

## 0. Non‑Negotiables

1. **No domain or business logic in transports** (HTTP routes or WS handlers) — transports validate and call a use-case only.
2. **All HTTP endpoints are BalanceGuard-wrapped** (surface-aware CORS/origin/auth/rate limits/headers).
3. **All WebSocket connections and events apply WSGuard principles**:
   - handshake origin allowlist
   - handshake auth (where applicable)
   - per-event validation + authz + rate limits + backpressure
4. **Never log raw message bodies or file contents.**
5. **Messages are stored as plain text** (no HTML). Rendering must escape output.
6. **If rich text is added later**, it must be parsed into a safe intermediate format (e.g., Markdown AST or a sanitized subset) and must **never** be stored or rendered as raw/unescaped HTML.
7. **File uploads use dedicated endpoints** — messages reference files by opaque IDs.

---

## 1. Responsibilities

### 1.1 What the Chat module owns

- Chat domain vocabulary (lobbies, rooms, invites, memberships, messages)
- Use-cases for:
  - listing lobbies/rooms
  - joining via invite
  - sending messages
  - read receipts
  - moderation actions
- Persistence boundary (`ChatRepository`)
- Typed realtime events (publish/subscribe)
- Attachment metadata (not raw file storage)

### 1.2 What the Chat module does NOT own

- HTTP parsing, Origin/CORS/CSRF, rate limiting mechanics, security headers (BalanceGuard)
- WS handshake primitives (WSGuard)
- UI rendering and DOM state
- Identity/session lifecycle (Identity module)
- Physical file storage implementation
- Secure Chat Mode (E2E encryption / key management)

---

## 2. Glossary

- **Lobby**: Top-level container for rooms.
- **Main Lobby**: Global lobby.
- **Sub-lobby**: Lobby scoped to an account manager + their customers.
- **Room**: A chat channel within a lobby.
- **Invite**: A token granting access to a room.
- **Membership**: A user’s participation in a room.
- **Guest session**: Short-lived anonymous identifier for the site widget.
- **Moderation action**: Logged action taken by a moderator/admin.

---

## 3. Chat Experience Requirements

### 3.1 Site chat widget (public)

- A persistent widget visible on the marketing site.
- Shows **availability**:
  - **Online** when at least one eligible admin is connected/active.
  - **Offline** otherwise.
- When offline, a visitor can leave a message which is delivered to an **admin inbox**.

Anonymous constraints:
- no login
- no session cookie required
- abuse controls rely on IP + guest session id

**v1.2 constraint:** no file uploads on public chat.

### 3.2 Guest Session (site widget)

Guest sessions provide abuse tracking without persistent identity:

- Identified by ephemeral UUID (cookie or local storage)
- Associated (server-side) with IP + User-Agent for abuse control
- Expires automatically after inactivity (recommended: **1 hour**)
- Not bound to an account or login

---

## 4. Structured Chat Model (Lobby → Sub-Lobby → Rooms)

- **Main Lobby**: global/system-level, admin-controlled
- **Sub-lobbies**: per account manager, contains assigned clients + moderators
- **Rooms**: invite-only by default, created within lobbies, used for topic/order separation

Joining rooms:
- by invitation from admin/account manager/moderator (if permitted)

---

## 5. Configuration (Environment)

All configuration is read via `src/shared/config/env.ts`.

Recommended env keys:

- `CHAT_MAX_MESSAGE_LENGTH` (default: **2048**)
- `CHAT_MAX_ATTACHMENTS_PER_MESSAGE` (default: **5**)
- `CHAT_ATTACHMENT_MAX_SIZE_BYTES`
- `CHAT_INVITE_EXPIRY_HOURS` (default: **168** / 7 days)
- `CHAT_RATE_LIMIT_WINDOW_MS`

---

## 6. Domain Model

### 6.1 Roles

- `admin`
- `account_manager`
- `moderator`
- `client`
- `guest` (site widget)

### 6.2 Message status lifecycle

Allowed transitions:

- `SENT → DELIVERED → READ`

Invalid transitions must be rejected by domain policy.

### 6.3 Soft delete policy

- Messages marked with `deleted_at` are hidden from clients.
- Admins may view deleted messages for audit.
- Optional recovery window may be implemented later.
- Hard delete (GDPR/right-to-erasure) is a separate administrative process.

---

## 7. Invites (Token Design)

Invite tokens must be:

- cryptographically random (recommended: **32 bytes**, base64url)
- stored **only as a hash** (SHA-256 recommended)
- single-use or limited-use
- time-limited with a maximum lifetime (recommended: **7 days**)

Invite metadata (recommended):

- `created_by_user_id`
- `expires_at`
- `max_uses`
- `used_count`
- `revoked_at` (optional)

---

## 8. Moderation (Auditability)

Moderation actions must capture:

- who performed the action
- what was moderated (message/room/user)
- when it happened
- why it happened

### 8.1 Moderation reason codes

Recommended canonical reasons:

```ts
export type ModerationReason =
  | "SPAM"
  | "HARASSMENT"
  | "OFF_TOPIC"
  | "INAPPROPRIATE_CONTENT"
  | "OTHER";
```

- Include optional free-text justification.

---

## 9. Application Layer (Use-cases)

### 9.1 sendMessage

Inputs:

- `room_id`
- `body_text`
- optional `attachment_ids[]`

Behavior:

- validate membership + role
- enforce body length (`CHAT_MAX_MESSAGE_LENGTH`)
- enforce attachment count (`CHAT_MAX_ATTACHMENTS_PER_MESSAGE`)
- persist
- emit `chat.message.sent`

### 9.2 markMessageAsRead

**Purpose:** record read receipts and drive unread indicators.

Inputs:

- `room_id`
- `message_id`

Behavior:

- validate membership
- update membership read pointers (e.g., `last_read_message_id` + timestamp)
- emit `chat.message.read`

---

## 10. Attachments (PDF + Images)

- Uploaded via dedicated endpoints.
- Stored externally (object storage).
- DB stores metadata only.

Security requirements:

- validate MIME + magic bytes
- enforce size limits
- never log file bytes
- downloads should use `Content-Disposition: attachment`

Preview generation (thumbnails/PDF previews) is optional and should run in an isolated environment.

---

## 11. Events (Standard Schema + Correlation)

Standardize event shape:

```ts
export type ChatEvent = Readonly<{
  type:
    | "chat.message.sent"
    | "chat.message.read"
    | "chat.room.joined"
    | "chat.message.moderated";
  payload: Record<string, unknown>;
  metadata: Readonly<{
    timestamp: string; // ISO8601
    request_id?: string;
    correlation_id?: string;
    actor: { kind: string; id?: string };
  }>;
}>;
```

Events are designed to be consumed later by:
- notifications
- activity-log
- gamification (future)

---

## 12. Logging Policy (DX + Safety)

All chat logging must go through a centralized structured logger that enforces redaction.

Minimal interface (conceptual):

```ts
export interface StructuredLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

Rules:
- never log `body_text`
- sanitize filenames before logging
- do not log signed URLs

---

## 13. Persistence (Database)

### 13.1 Canonical tables (v1 baseline)

Per `balance_kitchen_schema.md`, chat persistence uses:

- `chat_lobbies`
- `chat_rooms`
- `chat_room_memberships`
- `chat_messages`
- `chat_invites`
- `chat_attachments`
- `chat_moderation_actions` (append-only audit trail)

### 13.2 Notes & constraints

- `chat_messages.status` supports: `SENT | DELIVERED | READ`
- `chat_messages` supports:
  - `deleted_at` (soft delete)
  - `edited_at` (optional)
- Invite tokens:
  - must be cryptographically random
  - must be stored **hash-only** (never plaintext)
  - enforce max lifetime (recommended: 7 days)
- Moderation actions are **append-only** and must include `request_id` where available.


---

## 14. Transport Integration

### 14.1 HTTP (REST)

- Keep routes thin.
- Prefer versioned paths as recommended in `balance_kitchen_architecture.md`:
  - `/api/v1/site/...`
  - `/api/v1/client/...`
  - `/api/v1/admin/...`

Versioning becomes mandatory before any public API contract is treated as stable.


### 14.2 Typing indicators (future consideration)

Typing indicators are optional ephemeral WS events:

- `chat.user.typing.start`
- `chat.user.typing.stop`

Rules:
- rate-limited
- not persisted

---

## 15. Future Subsystem — Secure Chat Mode (Deferred)

Secure Chat Mode introduces:

- client-side encryption
- key management
- per-room key rotation

This is **not** part of Chat v1.x.

When introduced, it must be its own subsystem (e.g., `src/modules/secure-chat/**`) with its own threat model and explicit operational requirements.

---

## 16. Definition of Done (Chat v1.2)

- Site widget works (online/offline + inbox delivery)
- Lobby/room model implemented with invites
- Explicit env-configured limits enforced consistently
- Read receipts supported (`markMessageAsRead`)
- Moderation actions are audited with reason codes
- Attachments validated and safely downloadable
- BalanceGuard/WSGuard enforced everywhere
- Logs are structured and redacted
- Tests cover success/failure/rate-limit/origin/membership

