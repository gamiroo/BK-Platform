/* scripts/no-raw-fetch.mjs
 *
 * Enforces: UI code must never call fetch() directly.
 * Allowed location: src/frontend/lib/http-client.ts (and only there).
 *
 * This script scans src/frontend/** and fails if it finds `fetch(` anywhere
 * outside the allowed file.
 *
 * IMPORTANT:
 * - We intentionally ignore occurrences inside comments (// and /* ... *\/).
 */

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FRONTEND_DIR = path.join(ROOT, "src", "frontend");
const ALLOWLIST = new Set([
  path.join(FRONTEND_DIR, "lib", "http-client.ts"),
]);

const EXT_ALLOW = new Set([".ts", ".tsx", ".js", ".mjs", ".mts", ".cjs", ".cts"]);

function isIgnorableDir(name) {
  return (
    name === "node_modules" ||
    name === "dist" ||
    name === "build" ||
    name === ".git" ||
    name === ".turbo" ||
    name === ".vercel" ||
    name === "coverage"
  );
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (isIgnorableDir(ent.name)) continue;
      yield* walk(full);
      continue;
    }
    if (!ent.isFile()) continue;
    yield full;
  }
}

/**
 * Find `fetch(` in code, ignoring:
 * - // line comments
 * - /* block comments *\/
 *
 * This is a small purpose-built scanner (not a full parser), but is stable
 * enough for enforcement.
 */
function findFetchHits(text) {
  const hits = [];

  const lines = text.split(/\r?\n/u);

  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const originalLine = lines[i];

    // Walk the line char by char, respecting comment state.
    let code = "";
    let j = 0;

    while (j < originalLine.length) {
      const ch = originalLine[j];
      const next = originalLine[j + 1];

      if (inBlock) {
        // End of block comment?
        if (ch === "*" && next === "/") {
          inBlock = false;
          j += 2;
          continue;
        }
        j += 1;
        continue;
      }

      // Start of line comment?
      if (ch === "/" && next === "/") {
        break;
      }

      // Start of block comment?
      if (ch === "/" && next === "*") {
        inBlock = true;
        j += 2;
        continue;
      }

      code += ch;
      j += 1;
    }

    // Now scan code-only portion for fetch(
    const idx = code.indexOf("fetch(");
    if (idx !== -1) {
      hits.push({
        line: i + 1,
        col: idx + 1,
        sample: originalLine.trim(),
      });
    }
  }

  return hits;
}

async function main() {
  try {
    await fs.access(FRONTEND_DIR);
  } catch {
    console.log("[no-raw-fetch] src/frontend not found; skipping.");
    process.exit(0);
  }

  const offenders = [];

  for await (const file of walk(FRONTEND_DIR)) {
    const ext = path.extname(file);
    if (!EXT_ALLOW.has(ext)) continue;
    if (ALLOWLIST.has(file)) continue;

    const content = await fs.readFile(file, "utf8");
    const hits = findFetchHits(content);

    if (hits.length) offenders.push({ file, hits });
  }

  if (!offenders.length) {
    console.log("[no-raw-fetch] OK: no direct fetch() usage in UI code.");
    process.exit(0);
  }

  console.error(
    "\n[no-raw-fetch] FAIL: direct fetch() found outside src/frontend/lib/http-client.ts\n"
  );

  for (const o of offenders) {
    const rel = path.relative(ROOT, o.file);
    for (const h of o.hits) {
      console.error(`- ${rel}:${h.line}:${h.col}  ${h.sample}`);
    }
  }

  console.error(
    "\nFix: replace fetch() with helpers from src/frontend/lib/http-client.ts\n"
  );

  process.exit(1);
}

main().catch((err) => {
  console.error("[no-raw-fetch] unexpected error:", err);
  process.exit(2);
});
