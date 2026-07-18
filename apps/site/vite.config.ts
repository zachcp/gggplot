import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import wgslRollup from "@use-gpu/wgsl-loader/rollup";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPlugin = wasm as unknown as () => PluginOption;
const wgslPlugin = wgslRollup as unknown as () => PluginOption;

export default defineConfig({
  resolve: {
    alias: {
      "@gggplot/core/export": resolve(
        __dirname,
        "../../packages/core/src/export/png.ts",
      ),
      "@gggplot/core/plan": resolve(
        __dirname,
        "../../packages/core/src/plan/mod.ts",
      ),
      "@gggplot/core": resolve(__dirname, "../../packages/core/src/mod.ts"),
      "@gggplot/3d": resolve(__dirname, "../../packages/3d/src/mod.ts"),
      "@gggplot/reductions": resolve(
        __dirname,
        "../../packages/reductions/src/mod.ts",
      ),
    },
  },
  plugins: [
    // React automatic JSX for .tsx files. gggplot's Live components override
    // per-file with /** @jsxRuntime classic */ + @use-gpu/live createElement.
    react(),
    wasmPlugin(),
    wgslPlugin(),
  ],
  server: { port: 8080 },
  preview: { port: 8080 },
  build: { outDir: "dist", emptyOutDir: true },
});
