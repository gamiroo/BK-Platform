import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, "../../../dist/client"),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
