import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, "../../../dist/admin"),
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    strictPort: true,
  },
});
