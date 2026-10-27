# Vendored dependency shims

Temporary. Each entry here is wired in through `links` in the root `deno.json`
and must be deleted once upstream publishes a fix.

## `use-gpu-math/` — `@use-gpu/math@0.21.0` (removal: gggplot-i879)

The `@use-gpu/math@0.21.0` tarball from npm,
unchanged except for one addition to `package.json`:

```json
"exports": { ".": { "types": "./mjs/index.d.mts", "import": "./mjs/index.mjs", "require": "./cjs/index.cjs" } }
```

**Why:** without an `exports` map, Node and Deno resolve the package to its
CommonJS `main`, whose getter-style exports cannot be detected as named ESM
exports. `@use-gpu/glyph`'s ESM build does `import { sqr } from '@use-gpu/math'`
(new in 0.21), so loading glyph as ESM fails with "does not provide an export
named 'sqr'" under Deno and Node 26. Bundlers (Vite, webpack) read `module` and
are unaffected.

**Upstream fix:** add `"exports": { ".": "./src/index.ts" }` to
`packages/math/package.json` in use.gpu. `scripts/package-json-mjs-cjs.ts`
converts it into the map above at build time, as it already does for glyph,
state, traits and shader.

**Remove when:** a published `@use-gpu/math` has an `exports` map. Delete this
directory and the `links` entry in `deno.json`, run `deno install`, and confirm
`deno task test` still passes.

## `use-gpu-wgsl/` — `@use-gpu/wgsl@0.21.0`

The npm tarball, unchanged except for an added `cjs/package.json` containing
`{"type":"commonjs"}`.

**Why:** the package declares `"type":"module"`, but its `require` exports
point to CommonJS `.js` files in `cjs/`. Without a nested package boundary,
Node and Deno interpret those files as ESM and fail with `require is not
defined` when loading workbench. The ESM build used by Vite is unaffected.

**Remove when:** upstream publishes a CommonJS package boundary or switches its
CommonJS output and export targets to `.cjs`. Delete this directory and its
`links` entry, run `deno install`, and confirm `deno task test` passes.
