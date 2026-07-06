import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import wgslRollup from "@use-gpu/wgsl-loader/rollup";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@gggplot/core": resolve(__dirname, "../../packages/core/src/mod.ts"),
    },
  },
  plugins: [
    // React automatic JSX for .tsx files. gggplot's Live components override
    // per-file with /** @jsxRuntime classic */ + @use-gpu/live createElement.
    react(),
    wasm(),
    wgslRollup(),
  ],
  server: { port: 8080 },
  preview: { port: 8080 },
  build: { outDir: "dist", emptyOutDir: true },
});
