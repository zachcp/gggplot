import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import wgslRollup from "@use-gpu/wgsl-loader/rollup";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile } from "node:fs/promises";
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

/**
 * Null-guard @use-gpu/traits' sameArray (gggplot-cfe).
 *
 * traits/mjs/should.mjs:
 *   sameArray  = (same)=>(a, b)=>{ const isA = typeof a === 'object' && 'length' in a; ...
 *   sameObject = (same)=>(a, b)=>{ const isA = typeof a === 'object' && !!a; ...
 *
 * typeof null === 'object', so sameArray throws "Cannot use 'in' operator to
 * search for 'length' in null". sameObject directly below it guards with !!a;
 * sameArray does not, and sameShallow tries sameArray FIRST.
 *
 * @use-gpu/plot's Grid is memoized with
 * shouldEqual({ first: sameShallow(), second: sameShallow() }), and null is
 * the SUPPORTED "do not draw this side" value — grid.mjs itself branches on
 * props.first !== null. compile/mod.ts and compile/guides_3d.ts pass exactly
 * that, one null per single-axis grid, so every grid-bearing chart throws an
 * uncaught page error on RE-RENDER. Mount-only charts never showed it.
 *
 * There is no local encoding that avoids the null: suppressing a side by
 * generating zero ticks instead was implemented and measured, and it binds a
 * zero-size WebGPU buffer, which errors on every route on FIRST render — worse
 * than the bug. 0.20.0 is the latest published traits, so there is nothing to
 * bump to either. That leaves patching the dependency.
 *
 * Applied twice on purpose: `transform` covers the rollup build, and the
 * optimizeDeps esbuild plugin covers the dev server, which pre-bundles deps
 * and never runs plugin transforms.
 *
 * This THROWS rather than skipping when the expected source is absent. A patch
 * that silently stopped applying would let an uncaught page error back in with
 * nothing to notice it, which is the failure mode worth defending against on a
 * dependency-version bump.
 */
const TRAITS_SHOULD_MODULE = /@use-gpu[/\\+]traits.*should\.mjs$/;

/** The unguarded shape, matched by structure so upstream whitespace or
 * variable renames do not trip the guard: `typeof x === 'object' && 'length'
 * in x`, once for each side of the comparison. */
const UNGUARDED_LENGTH_TEST = /typeof (\w+) === 'object' && 'length' in \1/g;

function patchSameArrayNullGuard(code: string, id: string): string {
  const applied = (code.match(UNGUARDED_LENGTH_TEST) ?? []).length;
  if (applied !== 2) {
    throw new Error(
      `[gggplot-cfe] Expected 2 unguarded sameArray length tests in ${id}, ` +
        `found ${applied}. @use-gpu/traits changed shape: re-read should.mjs, ` +
        `then update this patch or drop it if upstream fixed the null guard.`,
    );
  }
  return code.replace(
    UNGUARDED_LENGTH_TEST,
    (_match, name: string) =>
      `typeof ${name} === 'object' && ${name} !== null && 'length' in ${name}`,
  );
}

function useGpuTraitsNullGuard(): PluginOption {
  return {
    name: "gggplot-use-gpu-traits-null-guard",
    enforce: "pre",
    // Build (rollup) path.
    transform(code, id) {
      if (!TRAITS_SHOULD_MODULE.test(id)) return null;
      return { code: patchSameArrayNullGuard(code, id), map: null };
    },
    // Dev path: deps are pre-bundled by esbuild, which never sees `transform`.
    config() {
      return {
        optimizeDeps: {
          // The ORT probe imports this only after page load. Pre-bundle it at
          // dev-server startup so first use cannot trigger Vite's optimization
          // reload and destroy the probe's execution context.
          include: ["onnxruntime-web/webgpu"],
          esbuildOptions: {
            plugins: [{
              name: "gggplot-use-gpu-traits-null-guard-esbuild",
              setup(build: {
                onLoad(
                  filter: { filter: RegExp },
                  cb: (args: { path: string }) => Promise<
                    { contents: string; loader: "js" }
                  >,
                ): void;
              }) {
                build.onLoad(
                  { filter: TRAITS_SHOULD_MODULE },
                  async ({ path }) => ({
                    contents: patchSameArrayNullGuard(
                      await readFile(path, "utf8"),
                      path,
                    ),
                    loader: "js",
                  }),
                );
              },
            }],
          },
        },
      };
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
      "@gggplot/core/dsl": resolve(
        __dirname,
        "../../packages/core/src/dsl/mod.ts",
      ),
      "@gggplot/core/compile": resolve(
        __dirname,
        "../../packages/core/src/compile/mod.ts",
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
    useGpuTraitsNullGuard(),
  ],
  server: { port: 8080 },
  preview: { port: 8080 },
  build: { outDir: "dist", emptyOutDir: true },
});
