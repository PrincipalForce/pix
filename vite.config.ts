import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 5173,
  },
});
