// Run: `deno task demo` (from repo root) or `deno run examples/emit-demo.ts`.
// Demonstrates the transpiler front-to-back without a browser: DSL → IR →
// compile → emit UseGPU Live source.

// Import the UseGPU-free pipeline pieces directly: compile/emit have no runtime
// UseGPU dependency, so this runs headless under `deno run` (no browser/WebGPU).
import { geomLine, geomPoint, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { emitSource } from "../src/emit/mod.ts";

const data = {
  wt: [2.6, 3.2, 3.4, 1.9, 4.1, 2.2],
  mpg: [21, 19, 18, 27, 15, 24],
};

const spec = ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 6, color: "#3b82f6" }))
  .add(geomLine({ color: "#ef4444" }))
  .build();

const tree = compile(spec);
console.log("=== Render Tree ===");
console.log(JSON.stringify(tree, null, 2));

console.log("\n=== Emitted UseGPU Live source ===\n");
console.log(emitSource(tree, "ScatterChart"));
