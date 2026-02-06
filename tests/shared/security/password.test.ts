import test from "node:test";
import assert from "node:assert/strict";

import { hashPassword, verifyPassword, needsRehash } from "../../../src/shared/security/password.js";

test("password: hash produces argon2id PHC string", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.ok(hash.includes("$argon2id$"), "expected argon2id PHC string");
});

test("password: verify true for correct password", async () => {
  const pw = "s3cret!";
  const hash = await hashPassword(pw);
  const ok = await verifyPassword(hash, pw);
  assert.equal(ok, true);
});

test("password: verify false for wrong password", async () => {
  const hash = await hashPassword("right");
  const ok = await verifyPassword(hash, "wrong");
  assert.equal(ok, false);
});

test("password: needsRehash returns boolean and is stable", async () => {
  const hash = await hashPassword("pw");
  const v = needsRehash(hash);
  assert.equal(typeof v, "boolean");
});
