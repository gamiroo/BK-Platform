// src/modules/enquiry/application/create-enquiry.ts
/**
 * Enquiry create use-case (application layer).
 *
 * Behavior:
 * - Always inserts enquiry locally (so it is never lost)
 * - Attempts Zoho Lead create
 * - If Zoho fails: marks enquiry as failed and throws (fail-closed to caller)
 */

import { AppError } from "../../../shared/errors/app-error.js";
import { createDb } from "../../../shared/db/client.js";
import { createZohoLead } from "../../../shared/infra/zoho/crm.js";
import { loadZohoEnv } from "../../../shared/infra/zoho/env.js";

export type CreateEnquiryInput = Readonly<{
  name: string;
  email: string;
  message: string;
}>;

export async function createEnquiry(input: CreateEnquiryInput): Promise<{ id: string; zoho_lead_id: string }> {
  // Ensure config is present early (fail fast, fail closed).
  // This throws if required vars are missing.
  const zoho = loadZohoEnv();

  const h = createDb();

  // 1) Insert locally (pending)
  let enquiryId: string;
  try {
    const rows = await h.sql<{ id: string }[]>`
      insert into enquiries (name, email, message, zoho_sync_status)
      values (${input.name}, ${input.email}, ${input.message}, 'pending')
      returning id
    `;
    enquiryId = rows[0]!.id;
  } catch (err) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      status: 500,
      message: "Failed to create enquiry",
      cause: err instanceof Error ? err : undefined,
    });
  }

  // 2) Sync to Zoho (fail-closed)
  try {
    const lead = await createZohoLead({
      // Minimal mapping:
      // Zoho Leads requires Last_Name, so we use full name as Last_Name for now.
      Last_Name: input.name,
      Email: input.email,
      Description: input.message,
      Lead_Source: zoho.leadSource,
    });

    await h.sql`
      update enquiries
      set zoho_sync_status = 'synced',
          zoho_lead_id = ${lead.leadId},
          zoho_synced_at = now(),
          zoho_last_error = null
      where id = ${enquiryId}
    `;

    return { id: enquiryId, zoho_lead_id: lead.leadId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Zoho sync failed";

    await h.sql`
      update enquiries
      set zoho_sync_status = 'failed',
          zoho_last_error = ${msg}
      where id = ${enquiryId}
    `;

    // Fail-closed to caller
    if (err instanceof AppError) throw err;

    throw new AppError({
      code: "ZOHO_SYNC_FAILED",
      status: 502,
      message: "Upstream CRM failed",
      cause: err instanceof Error ? err : undefined,
    });
  } finally {
    await h.close();
  }
}
