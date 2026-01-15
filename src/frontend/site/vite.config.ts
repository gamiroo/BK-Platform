// src/frontend/site/vite.config.ts
// Vite config for the public marketing site.
// - Keeps build output isolated by surface
// - Uses strict ESM + TS by default

import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, "../../../dist/site"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
