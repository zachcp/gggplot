import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import wgslRollup from "@use-gpu/wgsl-loader/rollup";
import { createReadStream } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPlugin = wasm as unknown as () => PluginOption;
const wgslPlugin = wgslRollup as unknown as () => PluginOption;
// Keep this aligned with the npm version pinned by apps/site/deno.json. Vite
// evaluates this config through a bundled Node-compatible loader, where
// import.meta.resolve() can return a non-file npm: URL.
const ortDist = resolve(
  __dirname,
  "../../node_modules/.deno/onnxruntime-web@1.27.0/node_modules/onnxruntime-web/dist",
);
const ortWasmFiles = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
];

/**
 * ORT's WebGPU entrypoint discovers its WASM helper files at runtime. Vite
 * bundles the binary but does not provide the sibling helper module at the
 * package-relative URL ORT expects, so expose both under one stable route.
 *
 * The asyncify WASM build is ~24MB — larger than the rest of the site by an
 * order of magnitude — so production only pays for it when the bundle actually
 * references ORT. The docs route currently inspects ONNX statically and never
 * imports onnxruntime-web, so the copy is skipped and `dist` stays small. Wire
 * a real ORT import in and the assets ship again with no config change, which
 * keeps this from silently breaking the day the runtime adapter lands.
 *
 * Dev always serves the route: a developer wiring the adapter up locally
 * should not have to think about this at all.
 */
function ortWasmAssets(): PluginOption {
  return {
    name: "gggplot-ort-wasm-assets",
    configureServer(server) {
      server.middlewares.use("/ort/", (request, response, next) => {
        const filename = request.url?.split("?")[0]?.slice(1);
        if (!filename || !ortWasmFiles.includes(filename)) {
          next();
          return;
        }
        response.setHeader(
          "Content-Type",
          filename.endsWith(".wasm")
            ? "application/wasm"
            : "text/javascript; charset=utf-8",
        );
        createReadStream(resolve(ortDist, filename))
          .on("error", () => next())
          .pipe(response);
      });
    },
    async writeBundle(options, bundle) {
      const referencesOrt = Object.values(bundle).some((chunk) =>
        chunk.type === "chunk" &&
        (chunk.code.includes("onnxruntime") || chunk.code.includes("ort-wasm"))
      );
      if (!referencesOrt) return;
      const outDir = options.dir
        ? resolve(__dirname, options.dir)
        : resolve(__dirname, "dist");
      const targetDir = resolve(outDir, "ort");
      await mkdir(targetDir, { recursive: true });
      await Promise.all(
        ortWasmFiles.map((filename) =>
          copyFile(resolve(ortDist, filename), resolve(targetDir, filename))
        ),
      );
    },
  };
}

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
      "@gggplot/reductions": resolve(
        __dirname,
        "../../packages/reductions/src/mod.ts",
      ),
      "@gggplot/model-inspect": resolve(
        __dirname,
        "../../packages/model-inspect/src/mod.ts",
      ),
    },
  },
  plugins: [
    // React automatic JSX for .tsx files. gggplot's Live components override
    // per-file with /** @jsxRuntime classic */ + @use-gpu/live createElement.
    react(),
    wasmPlugin(),
    wgslPlugin(),
    ortWasmAssets(),
  ],
  server: { port: 8080 },
  preview: { port: 8080 },
  build: { outDir: "dist", emptyOutDir: true },
});
