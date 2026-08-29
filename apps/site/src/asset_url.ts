/**
 * Resolve a public asset path against the deployment base.
 *
 * The docs ship to GitHub Pages under a project subpath (`/gggplot/`), passed
 * to the build as `--base=/gggplot/`. Vite's `base` rewrites the URLs it emits
 * itself — hashed bundles, CSS, imported assets — but it cannot rewrite a
 * root-absolute string that source code hands to `fetch` at runtime. Those
 * requests kept resolving against the domain root and 404ing (gggplot-a0i).
 *
 * The failure was not a quiet one. `@use-gpu/glyph` parses TTFs in a Rust
 * wasm-bindgen module; handed GitHub's HTML 404 page instead of a font, it
 * panicked (`RuntimeError: unreachable`) and unwound leaving its `RefCell`
 * borrowed, so every later call into it threw "recursive use of an object
 * detected which would lead to unsafe aliasing in rust" and whole example
 * sections rendered as "Chart renderer failed".
 *
 * Declared asset paths stay root-relative — they are stable identifiers, and
 * the Deno tests join them onto `public/` directly — so resolution happens
 * here, at the point of fetch.
 */

/** Vite defines `import.meta.env`; Deno's test runner does not. */
const base: string =
  (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ??
    "/";

/** Join `path` onto the deployment base, tolerating a slash on either side. */
export function assetUrl(path: string): string {
  if (/^[a-z]+:\/\//i.test(path)) return path;
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}
