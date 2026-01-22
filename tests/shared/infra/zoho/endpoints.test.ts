// tests/shared/infra/zoho/endpoints.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { zohoEndpoints } from "../../../../src/shared/infra/zoho/endpoints.ts";

test("zohoEndpoints: AU maps to .com.au domains", () => {
  const eps = zohoEndpoints("AU");
  assert.equal(eps.accountsBaseUrl, "https://accounts.zoho.com.au");
  assert.equal(eps.apiBaseUrl, "https://www.zohoapis.com.au");
});

test("zohoEndpoints: US maps to .com domains", () => {
  const eps = zohoEndpoints("US");
  assert.equal(eps.accountsBaseUrl, "https://accounts.zoho.com");
  assert.equal(eps.apiBaseUrl, "https://www.zohoapis.com");
});
