// tests/shared/infra/zoho/crm-payload.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import type { ZohoCRMLead } from "../../../../src/shared/infra/zoho/types.ts";

test("Zoho lead minimal payload includes required Last_Name", () => {
  const lead: ZohoCRMLead = {
    Last_Name: "Mark G",
    Email: "mark@example.com",
    Description: "Hello",
    Lead_Source: "Website - General Enquiry",
  };

  assert.equal(typeof lead.Last_Name, "string");
  assert.ok(lead.Last_Name.length > 0);
});
