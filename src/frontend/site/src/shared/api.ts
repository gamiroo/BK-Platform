// src/frontend/site/src/shared/api.ts

function inferApiBaseUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

  const explicit = env?.VITE_API_BASE_URL;
  if (explicit && explicit.length > 0) return explicit;

  // Local dev fallback only
  if (window.location.hostname === "localhost" && window.location.port === "5173") {
    return "http://localhost:3000";
  }

  // Fail fast in production-like environments
  throw new Error(
    "VITE_API_BASE_URL is not configured for the site surface"
  );
}

export const API_BASE_URL = inferApiBaseUrl();

export function apiUrl(path: string): string {
  if (!path.startsWith("/")) return `${API_BASE_URL}/${path}`;
  return `${API_BASE_URL}${path}`;
}
