// eslint.config.js (ESLint v9 flat config)
// Key rule: typed linting (parserOptions.project) must ONLY apply to TS/TSX files.
// JS/MJS config scripts should NOT use typed linting.

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  // -----------------------------
  // 0) Global ignores
  // -----------------------------
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },

  // -----------------------------
  // 1) Base JS rules (non-typed)
  // -----------------------------
  js.configs.recommended,

  // -----------------------------
  // 2) JS/MJS/CJS files that run in Node (configs + scripts)
  //    Ensure Node globals exist (process/console/etc)
  // -----------------------------
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
      },
    },
    rules: {
      // Allow console in scripts/config; app code uses pino anyway
      "no-console": "off",
    },
  },

  // -----------------------------
  // 3) TypeScript rules (non-typed baseline)
  // -----------------------------
  ...tseslint.configs.recommended,

  // -----------------------------
  // 4) TypeScript rules (typed linting layer)
  //    IMPORTANT: only TS/TSX get parserOptions.project
  // -----------------------------
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "eqeqeq": ["error", "always"],
      "no-debugger": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/no-explicit-any": "error",

      // typed rule (requires project)
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
];
