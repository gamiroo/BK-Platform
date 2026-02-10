import type { BillingRepoPort } from "../ports/billing_repo.port.js";

export async function withBillingEventProcessing<T>(args: {
  repo: BillingRepoPort;
  billingEventId: string;
  nowMs: number;
  work: () => Promise<T>;
}): Promise<T> {
  const { repo, billingEventId, nowMs, work } = args;

  await repo.events.markProcessing({ id: billingEventId, nowMs });

  try {
    const result = await work();
    await repo.events.markProcessed({ id: billingEventId, nowMs: Date.now() });
    return result;
  } catch (err) {
    const e = err as { code?: string; message?: string };

    const failureReason = e?.message ?? "unknown_error";
    const lastErrorCode = e?.code;

    const payload: { id: string; nowMs: number; failureReason: string; lastErrorCode?: string } = {
      id: billingEventId,
      nowMs: Date.now(),
      failureReason,
    };
    if (typeof lastErrorCode === "string") payload.lastErrorCode = lastErrorCode;

    await repo.events.markFailed(payload);
    throw err;
  }
}
