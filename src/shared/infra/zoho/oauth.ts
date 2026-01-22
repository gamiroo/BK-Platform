// src/shared/infra/zoho/oauth.ts
/**
 * Zoho OAuth access token refresh with in-memory cache.
 *
 * Serverless note:
 * - Cache may persist across invocations on warm instances.
 * - It is safe to re-refresh if cold.
 */

import { AppError } from "../../errors/app-error.js";
import { logger } from "../../logging/logger.js";
import { loadZohoEnv } from "./env.ts";
import { zohoEndpoints } from "./endpoints.ts";
import type { ZohoTokenResponse } from "./types.ts";

type CachedToken = Readonly<{
  token: string;
  expiresAtMs: number;
}>;

let cached: CachedToken | null = null;

function nowMs(): number {
  return Date.now();
}

function abortAfter(ms: number): AbortSignal {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  // prevent ref leak in node
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof t.unref === "function") t.unref();
  return c.signal;
}

export async function getZohoAccessToken(): Promise<string> {
  const env = loadZohoEnv();
  const eps = zohoEndpoints(env.dataCenter);

  if (cached && cached.expiresAtMs > nowMs() + 30_000) {
    return cached.token;
  }

  const tokenEndpoint = `${eps.accountsBaseUrl}/oauth/v2/token`;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.clientId,
    client_secret: env.clientSecret,
    refresh_token: env.refreshToken,
  });

  logger.info({ event: "ZOHO_TOKEN_REFRESH_START" }, "zoho_token_refresh_start");

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: abortAfter(env.timeoutMs),
  });

  const text = await res.text();

  if (!res.ok) {
    logger.error(
      {
        event: "ZOHO_TOKEN_REFRESH_FAILED",
        status: res.status,
        body: text.slice(0, 300),
      },
      "zoho_token_refresh_failed"
    );

    throw new AppError({
      code: "ZOHO_AUTH_FAILED",
      status: 502,
      message: "Upstream auth failed",
    });
  }

  let data: ZohoTokenResponse;
  try {
    data = JSON.parse(text) as ZohoTokenResponse;
  } catch {
    throw new AppError({
      code: "ZOHO_AUTH_FAILED",
      status: 502,
      message: "Upstream auth failed",
    });
  }

  const token = data.access_token;
  const expiresIn = data.expires_in ?? 0;

  if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new AppError({
      code: "ZOHO_AUTH_FAILED",
      status: 502,
      message: "Upstream auth failed",
    });
  }

  cached = { token, expiresAtMs: nowMs() + expiresIn * 1000 };

  logger.info({ event: "ZOHO_TOKEN_REFRESH_OK" }, "zoho_token_refresh_ok");

  return token;
}
