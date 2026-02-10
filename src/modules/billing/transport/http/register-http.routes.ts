import type { BillingRepoPort } from "../../application/ports/billing_repo.port.js";
import { stripeBillingWebhookRoute } from "./routes/stripe_billing_webhook.routes.js";

/**
 * Billing routes rely on BalanceGuard ctx carrying request_id for traceability.
 * Constrain ctx accordingly while still keeping it generic for the server layer.
 */
export type BillingCtxBase = { request_id?: string };

export type BillingHandler<Ctx extends BillingCtxBase = BillingCtxBase> = (ctx: Ctx, req: Request) => Promise<Response>;

export type BillingRouter<Ctx extends BillingCtxBase = BillingCtxBase> = {
  register: (method: string, path: string, handler: BillingHandler<Ctx>) => void;
};

export type BillingRouteWrapper<Ctx extends BillingCtxBase = BillingCtxBase> = (
  opts: {
    surface: "site" | "client" | "admin";
    auth: { required: boolean; roles?: string[]; aal?: "AAL1" | "AAL2" | "AAL3" };
    cors: { mode: "site" | "client" | "admin" };
    origin: { required: boolean; sensitive?: boolean };
    csrf: { required: boolean };
    rateLimit: {
      key: (ctx: Ctx) => string;
      limit: { windowMs: number; max: number };
      burst?: { rate: number; capacity: number };
    };
    body?: { maxBytes?: number };
  },
  handler: BillingHandler<Ctx>
) => BillingHandler<Ctx>;

export function registerBillingHttpRoutes<Ctx extends BillingCtxBase = BillingCtxBase>(args: {
  router: BillingRouter<Ctx>;
  repo: BillingRepoPort;
  env: Record<string, string | undefined>;
  wrap: BillingRouteWrapper<Ctx>;
}) {
  const handler = stripeBillingWebhookRoute({ repo: args.repo, env: args.env });

  const wrapped = args.wrap(
    {
      surface: "site",
      auth: { required: false },
      cors: { mode: "site" },
      origin: { required: false },
      csrf: { required: false },
      rateLimit: {
        key: (_ctx) => "public:stripe_webhook",
        limit: { windowMs: 60_000, max: 120 },
      },
      body: { maxBytes: 1_000_000 },
    },
    handler
  );

  args.router.register("POST", "/webhooks/stripe/billing", wrapped);
}
