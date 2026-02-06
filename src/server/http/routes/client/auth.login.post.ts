// src/server/http/routes/client/auth.login.post.ts
//
// Client auth: login (DB-backed)
//
// Contract:
// - POST /api/client/auth/login
// - Accepts JSON body: { email, password }
// - Sets client session cookie (HttpOnly) — scoped per sessionCookieConfig(surface).path
// - Sets CSRF cookie (NOT HttpOnly): per-surface only
// - Returns canonical ok envelope with actor (+ optional csrf metadata)

import { balanceguardClient } from "../../../../shared/security/balanceguard/wrappers.js";
import { json } from "../../../../shared/http/responses.js";
import { validate, type Validator } from "../../../../shared/validation/validate.js";
import { AppError } from "../../../../shared/errors/app-error.js";
import type { RequestContext } from "../../../../shared/logging/request-context.js";

import { loginUseCase } from "../../../../modules/identity/application/login.usecase.js";
import { getIdentityRepository } from "../../../../modules/identity/infrastructure/sessions-store.js";

import { sessionCookieConfig } from "../../../../shared/security/balanceguard/session-cookie-config.js";
import { setSessionCookie } from "../../../../shared/security/balanceguard/session-cookie.js";
import { setCsrfCookie, csrfCookieName } from "../../../../shared/security/balanceguard/csrf.js";

import { extractIp } from "../../../../shared/security/balanceguard/ip.js";
import { randomUUID } from "node:crypto";

type LoginBody = Readonly<{ email: string; password: string }>;

const validateLoginBody: Validator<LoginBody> = (input: unknown) => {
  if (typeof input !== "object" || input === null) throw new Error("Body must be an object");

  const rec = input as Record<string, unknown>;
  const email = rec.email;
  const password = rec.password;

  if (typeof email !== "string") throw new Error("email must be a string");
  if (typeof password !== "string") throw new Error("password must be a string");

  const trimmed = email.trim();
  if (trimmed.length < 3) throw new Error("email is too short");
  if (password.length < 1) throw new Error("password is required");

  for (const k of Object.keys(rec)) {
    if (k !== "email" && k !== "password") throw new Error(`Unexpected field: ${k}`);
  }

  return { email: trimmed, password };
};

type ClientLoginResponse = Readonly<{
  actor: Readonly<{ kind: "client"; role: "client"; user_id: string }>;
  csrf_token: string;
  csrf_cookie: string;
}>;

export const clientAuthLogin = balanceguardClient(
  { requireAuth: false, requireCsrf: false },
  async (ctx: RequestContext, req: Request) => {
    const raw = await req.json().catch((err: unknown) => {
      throw new AppError({
        code: "VALIDATION_FAILED",
        status: 400,
        message: "Validation failed",
        details: { reason: err instanceof Error ? err.message : String(err) },
      });
    });

    const body = validate(validateLoginBody, raw);

    const repo = await getIdentityRepository();

    const userAgent = req.headers.get("user-agent");
    const ip = extractIp(req);

    const out = await loginUseCase(repo, {
      email: body.email,
      password: body.password,
      expectedRole: "client",
      userAgent,
      ip,
    });

    // Fail closed if actor ever drifts
    if (out.actor.kind !== "client") {
      throw new AppError({
        code: "WRONG_SURFACE",
        status: 400,
        message: "Wrong surface",
        details: { reason: "client_login_actor_not_client" },
      });
    }

    const cfg = sessionCookieConfig("client");

    // CSRF token generated at transport boundary (server)
    const csrfToken = randomUUID();

    const base = json<ClientLoginResponse>(ctx, {
      actor: { kind: "client", role: "client", user_id: out.actor.user_id },
      csrf_token: csrfToken,
      csrf_cookie: csrfCookieName("client"),
    });

    const headers = new Headers(base.headers);

    // ✅ Session cookie (HttpOnly) — respects per-surface Path from sessionCookieConfig
    setSessionCookie(headers, "client", out.sessionId);

    // CSRF cookie (NOT HttpOnly) — per-surface only (no legacy)
    setCsrfCookie(headers, "client", csrfToken, { secure: cfg.secure, sameSite: cfg.sameSite });

    return new Response(base.body, { status: base.status, headers });
  }
);
