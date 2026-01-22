// src/modules/enquiry/application/list-enquiries.ts
/**
 * Enquiry list use-case (application layer).
 */

import { createDb } from "../../../shared/db/client.js";

export type EnquiryRow = Readonly<{
  id: string;
  name: string;
  email: string;
  message: string;
  zoho_sync_status: string;
  zoho_lead_id: string | null;
  created_at: string;
}>;

export async function listEnquiries(limit: number): Promise<EnquiryRow[]> {
  const safeLimit = Math.max(1, Math.min(limit, 200));

  const h = createDb();
  try {
    const rows = await h.sql<EnquiryRow[]>`
      select id, name, email, message, zoho_sync_status, zoho_lead_id, created_at
      from enquiries
      order by created_at desc
      limit ${safeLimit}
    `;
    return rows;
  } finally {
    await h.close();
  }
}
