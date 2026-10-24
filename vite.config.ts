import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// In dev, Vite serves the client and proxies everything dynamic to the Bun server.
const API_TARGET = `http://127.0.0.1:${process.env.PORT ?? 5000}`;

export default defineConfig({
  root: r("./client"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": r("./client/src"),
      "@shared": r("./shared"),
    },
  },
  build: {
    outDir: r("./dist/public"),
    emptyOutDir: true,
    target: "es2022",
    reportCompressedSize: false,
  },
  server: {
    proxy: {
      "/api": API_TARGET,
      "/uploads": API_TARGET,
      "/ws": { target: API_TARGET, ws: true },
    },
  },
});
