// scripts/run-tests.mjs
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TESTS_DIR = path.join(ROOT, "tests");

function walk(dir) {
  /** @type {string[]} */
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function isTestFile(p) {
  return p.endsWith(".test.ts") || p.endsWith(".test.tsx");
}

if (!statSync(TESTS_DIR, { throwIfNoEntry: false })) {
  console.error(`Missing tests directory: ${TESTS_DIR}`);
  process.exit(1);
}

const files = walk(TESTS_DIR)
  .filter(isTestFile)
  .map((p) => path.relative(ROOT, p))
  .sort();

if (files.length === 0) {
  console.error("No test files found under tests/**");
  process.exit(1);
}

// Spawn node test runner with tsx loader
const args = ["--import", "tsx", "--test", ...files];

const r = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});

process.exit(r.status ?? 1);
