import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve("desktop/renderer"),
  plugins: [react()],
  base: "./",
  build: { outDir: resolve("dist-desktop/renderer"), emptyOutDir: true }
});
