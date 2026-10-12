// The Use.GPU compatibility surface must fail loudly on a dependency bump
// (gggplot-hn39). runtime/usegpu_compat.ts types each export by hand, so
// `deno check` cannot see an export that moved or disappeared: it arrives as
// `undefined` and fails later, far from the cause. Use.GPU 0.21 did exactly
// that to LayoutContext, QueueReconciler, LoopContext and RangeContext.
import { assert, assertThrows } from "@std/assert";
import * as Compat from "../src/runtime/usegpu_compat.ts";

Deno.test("every Use.GPU value the compat surface re-exports is defined", () => {
  const missing = Object.entries(Compat)
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);
  assert(
    missing.length === 0,
    `usegpu_compat exports undefined values: ${missing.join(", ")}. ` +
      `They moved package or were removed upstream.`,
  );
});

Deno.test("esm() rejects a probe the package does not export", () => {
  assertThrows(
    () => Compat.esm({ default: { present: 1 } }, "absent" as never),
    Error,
    'probe "absent"',
  );
  // Both shapes still resolve: CommonJS (on .default) and ESM (direct).
  const cjs = { default: { probe: 1 } };
  assert(
    (Compat.esm(cjs as never, "probe" as never) as unknown) === cjs.default,
  );
  const direct = { probe: 1 };
  assert(Compat.esm(direct, "probe") === direct);
});

// Each of these resolves a Use.GPU namespace through esm() at module load, so
// loading them proves every probe still names a symbol its package owns.
const ESM_MODULES = [
  "../src/components/gg_plot_root.ts",
  "../src/export/png.ts",
  "../src/render/GGPlot.tsx",
  "../src/render/prism_instances_3d.tsx",
  "../src/render/render_tree.tsx",
  "../src/render/rotated_label.tsx",
  "../src/render/scene_picker.tsx",
];

for (const path of ESM_MODULES) {
  Deno.test(`${path} resolves its Use.GPU namespaces`, async () => {
    await import(path);
  });
}
