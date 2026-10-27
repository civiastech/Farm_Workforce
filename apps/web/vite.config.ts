import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the API runs separately; proxy keeps the browser on one origin.
    proxy: {
      "/api": { target: process.env.API_URL ?? "http://localhost:3000" },
    },
  },
  build: {
    // Maps are generated for error tracking but not referenced from (or served with) the bundle.
    sourcemap: "hidden",
    target: "es2022",
  },
  test: {
    environment: "jsdom",
  },
});
