# Balance Kitchen (BK)

Framework-free platform:

- Backend: Node.js + TypeScript (native HTTP + WebSockets)
- Frontend: TypeScript + HTML + DOM + CSS Modules

## Dev rules (non-negotiable)

- Trunk-based development
- CI gates: typecheck, lint, test, build
- Every HTTP route must be BalanceGuard-wrapped
- Docs are the source of truth (see `/docs`)

## Commands

- `pnpm i`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm check-balanceguard`
