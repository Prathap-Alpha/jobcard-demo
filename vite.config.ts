import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // "/" locally; VITE_BASE="/jobcard-demo/" for the GitHub Pages subpath build.
  base: process.env.VITE_BASE ?? "/",
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "client", "src") } },
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: { outDir: path.resolve(import.meta.dirname, "dist"), emptyOutDir: true },
});
