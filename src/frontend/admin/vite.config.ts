import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, "../../../dist/admin"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5175,
    strictPort: true,

    // ✅ allow localtest.me + subdomains
    allowedHosts: [".localtest.me", "localtest.me"],

    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
