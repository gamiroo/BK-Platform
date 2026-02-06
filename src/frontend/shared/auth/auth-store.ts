export type AuthActor = {
  kind: "client" | "admin";
  role: "client" | "admin";
  user_id: string;
};

export type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; actor: AuthActor };

let state: AuthState = { status: "loading" };
const listeners = new Set<() => void>();

export function getAuthState(): AuthState {
  return state;
}

export function setAuthState(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeAuth(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
