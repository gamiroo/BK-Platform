import type { BillingRepoPort } from "../ports/billing_repo.port.js";
import type { BillingTransactionRow, BillingTransactionUpsert } from "../../domain/types/billing-types.js";

export async function upsertTransaction(repo: BillingRepoPort, tx: BillingTransactionUpsert): Promise<BillingTransactionRow> {
  return repo.transactions.upsertByStripeObject(tx);
}
