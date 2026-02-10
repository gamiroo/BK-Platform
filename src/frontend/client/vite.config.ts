import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, "../../../dist/client"),
    emptyOutDir: true,
  },
  server: {
    host: true, // listen on all interfaces so client.localtest.me works
    port: 5174,
    strictPort: true,

    // ✅ allow localtest.me + subdomains (Vite host allowlist)
    allowedHosts: [".localtest.me", "localtest.me"],

    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
