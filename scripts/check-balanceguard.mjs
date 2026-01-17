import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROUTES_DIR = path.join(ROOT, "src", "server", "http", "routes");
const ROUTE_FILE_REGEX = /\.ts$/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function fail(msg) {
  console.error(`\n❌ BalanceGuard compliance failed:\n${msg}\n`);
  process.exit(1);
}

/**
 * Remove JS/TS comments so our heuristics don't match examples in comments.
 * This is not a full parser (Day 0), but good enough to prevent false positives.
 */
function stripComments(src) {
  // Remove block comments /* ... */
  let out = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments // ...
  out = out.replace(/\/\/.*$/gm, "");
  return out;
}

function main() {
  if (!fs.existsSync(ROUTES_DIR)) {
    fail(`Routes directory not found: ${ROUTES_DIR}`);
  }

  const files = walk(ROUTES_DIR).filter((f) => ROUTE_FILE_REGEX.test(f));
  if (files.length === 0) {
    console.log("ℹ️ No route files found yet — skipping BalanceGuard compliance scan.");
    return;
  }

  const offenders = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const raw = fs.readFileSync(file, "utf8");
    const src = stripComments(raw);

    // Heuristic: only enforce BalanceGuard if the file appears to define real endpoints.
    // We intentionally do NOT enforce for "registry-only" files that just export a register* function.
    const looksLikeItDefinesRoutes =
      /\brouter\.(get|post|put|patch|delete)\s*\(/.test(src) ||
      /\b(app|router)\s*\.\s*(get|post|put|patch|delete)\s*\(/.test(src) ||
      /\bexport\s+async\s+function\s+\w+\s*\(/.test(src) ||
      /\bnew\s+Response\s*\(/.test(src);

    if (!looksLikeItDefinesRoutes) continue;

    // Accept either the raw wrapper `balanceguard(` OR the surface wrappers
    // `balanceguardSite(` / `balanceguardClient(` / `balanceguardAdmin(`.
    const hasBalanceGuardCall = /\bbalanceguard(?:Site|Client|Admin)?\s*\(/.test(src);

    if (!hasBalanceGuardCall) offenders.push(rel);
  }

  if (offenders.length) {
    fail(
      [
        "The following route files define endpoints but do not appear to be BalanceGuard-wrapped:",
        ...offenders.map((x) => `- ${x}`),
        "",
        "Expected: any real HTTP handler must be wrapped with balanceguard(...).",
        "Registry-only route modules (no handlers) are allowed to omit BalanceGuard.",
      ].join("\n")
    );
  }

  console.log(`✅ BalanceGuard compliance passed (${files.length} route file(s) scanned).`);
}

main();
