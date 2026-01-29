// tests/shared/db/env-marker.test.ts
import test from "node:test";
import assert from "node:assert/strict";

import { parseDbEnvMarker, expectedMarkerFromRuntime } from "../../../src/shared/db/env-marker.js";

test("parseDbEnvMarker: accepts 'dev' and 'prod'", () => {
  assert.equal(parseDbEnvMarker("dev"), "dev");
  assert.equal(parseDbEnvMarker("prod"), "prod");
});

test("parseDbEnvMarker: rejects unknown values", () => {
  assert.throws(() => parseDbEnvMarker("development"), /invalid/i);
  assert.throws(() => parseDbEnvMarker("production"), /invalid/i);
  assert.throws(() => parseDbEnvMarker(""), /invalid/i);
});

test("expectedMarkerFromRuntime: maps NODE_ENV development/test -> dev", () => {
  assert.equal(expectedMarkerFromRuntime({ node_env: "development" }), "dev");
  assert.equal(expectedMarkerFromRuntime({ node_env: "test" }), "dev");
});

test("expectedMarkerFromRuntime: maps NODE_ENV production -> prod", () => {
  assert.equal(expectedMarkerFromRuntime({ node_env: "production" }), "prod");
});

test("expectedMarkerFromRuntime: if VERCEL_ENV=production, always expects prod", () => {
  assert.equal(expectedMarkerFromRuntime({ node_env: "development", vercel_env: "production" }), "prod");
});
