// scripts/require-env.mjs
// Fail fast if required env vars are missing.
//
// Usage examples:
//   node scripts/require-env.mjs DATABASE_URL NODE_ENV
//   node scripts/require-env.mjs --any DATABASE_URL DATABASE_URL_TEST
//   node scripts/require-env.mjs --if NODE_ENV=test DATABASE_URL

function usage(exitCode = 1) {
  console.error(`
Usage:
  node scripts/require-env.mjs [--any] [--if NAME=value] VAR [VAR...]

Flags:
  --any              At least ONE of the listed vars must be set & non-empty
  --if NAME=value    Only enforce when process.env[NAME] === value

Examples:
  node scripts/require-env.mjs DATABASE_URL NODE_ENV
  node scripts/require-env.mjs --any DATABASE_URL DATABASE_URL_TEST
  node scripts/require-env.mjs --if NODE_ENV=test DATABASE_URL
`.trim());
  process.exit(exitCode);
}

const argv = process.argv.slice(2);

let mode = "all"; // "all" | "any"
let condName = null;
let condValue = null;

while (argv.length) {
  const token = argv[0];

  if (token === "--help" || token === "-h") usage(0);

  if (token === "--any") {
    mode = "any";
    argv.shift();
    continue;
  }

  if (token === "--if") {
    argv.shift();
    const expr = argv.shift();
    if (!expr || !expr.includes("=")) {
      console.error("[require-env] --if expects NAME=value");
      usage(1);
    }
    const [name, ...rest] = expr.split("=");
    condName = name;
    condValue = rest.join("="); // allow '=' in value
    continue;
  }

  break;
}

const requiredVars = argv;
if (requiredVars.length === 0) usage(1);

if (condName) {
  const actual = process.env[condName] ?? "";
  if (actual !== condValue) {
    // Condition not met: do nothing
    process.exit(0);
  }
}

const isSet = (key) => {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
};

if (mode === "any") {
  const ok = requiredVars.some(isSet);
  if (!ok) {
    console.error(`[require-env] Expected at least one of: ${requiredVars.join(", ")}`);
    for (const k of requiredVars) console.error(`  - ${k}=${isSet(k) ? "(set)" : "(missing)"}`);
    process.exit(1);
  }
  process.exit(0);
}

// mode === "all"
const missing = requiredVars.filter((k) => !isSet(k));
if (missing.length) {
  console.error(`[require-env] Missing required env var(s): ${missing.join(", ")}`);
  for (const k of missing) console.error(`  - ${k}=${isSet(k) ? "(set)" : "(missing)"}`);
  process.exit(1);
}

process.exit(0);
