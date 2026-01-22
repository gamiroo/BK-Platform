function inferApiBaseUrl(): string {
  const explicit = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL;
  if (explicit && explicit.length > 0) return explicit;

  // Local dev: site on 5173, api likely on 3000
  const host = window.location.hostname;
  const port = window.location.port;

  if (host === "localhost" && port === "5173") return "http://localhost:3000";

  // Production: if you front the API behind the same origin via rewrites, this works.
  // If you use api.<domain>, set VITE_API_BASE_URL in the site project.
  return "";
}

export const API_BASE_URL = inferApiBaseUrl();

export function apiUrl(path: string): string {
  if (!path.startsWith("/")) return `${API_BASE_URL}/${path}`;
  return `${API_BASE_URL}${path}`;
}
