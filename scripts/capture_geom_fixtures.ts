// One-off reproducible fixture harness for gggplot-elv (geom registry refactor).
// Compiles a spread of representative specs and writes their RenderTree JSON so
// the pure-refactor guarantee (deep-equal output before/after) is verifiable.
//
// Usage:
//   deno run -A scripts/capture_geom_fixtures.ts            # write fixtures
//   deno run -A scripts/capture_geom_fixtures.ts --check    # compare vs saved
import {
  annotate,
  coordPolar,
  facetWrap,
  geomArea,
  geomBar,
  geomBoxplot,
  geomCol,
  geomCurve,
  geomErrorbar,
  geomHistogram,
  geomHline,
  geomLabel,
  geomLine,
  geomPoint,
  geomPolygon,
  geomRug,
  geomSpoke,
  geomStep,
  geomText,
  geomTile,
  geomViolin,
  ggplot,
  scaleFill,
  scaleYContinuous,
} from "../packages/core/src/dsl/mod.ts";
import { compile } from "../packages/core/src/compile/mod.ts";
import { approximateTextMeasurer } from "../packages/core/src/render/font_resources.ts";

// deno-lint-ignore no-explicit-any
type Spec = any;

const layout = {
  width: 640,
  height: 480,
  measureText: approximateTextMeasurer,
};

export const cases: Array<{ name: string; build: () => Spec }> = [
  {
    name: "stacked_bar",
    build: () =>
      ggplot(
        {
          cls: ["a", "a", "b", "b", "c", "c"],
          drv: ["x", "y", "x", "y", "x", "y"],
        },
        { x: "cls", fill: "drv" },
      ).add(geomBar()).build(),
  },
  {
    name: "dodged_col",
    build: () =>
      ggplot(
        {
          cls: ["a", "a", "b", "b"],
          drv: ["x", "y", "x", "y"],
          n: [3, 5, 2, 8],
        },
        { x: "cls", y: "n", fill: "drv" },
      ).add(geomCol({ position: "dodge" })).build(),
  },
  {
    name: "faceted_point",
    build: () =>
      ggplot(
        {
          x: [1, 2, 3, 4, 5, 6],
          y: [2, 4, 1, 8, 3, 5],
          g: ["p", "p", "p", "q", "q", "q"],
          c: ["m", "n", "m", "n", "m", "n"],
        },
        { x: "x", y: "y", color: "c" },
      ).add(geomPoint({ size: 3 })).add(facetWrap(["g"])).build(),
  },
  {
    name: "polar_bar",
    build: () =>
      ggplot(
        { cls: ["a", "b", "c", "d"], n: [4, 7, 2, 9] },
        { x: "cls", y: "n", fill: "cls" },
      ).add(geomCol()).add(coordPolar({ theta: "x" })).build(),
  },
  {
    name: "text_and_label",
    build: () =>
      ggplot(
        {
          x: [1, 2, 3],
          y: [1, 2, 3],
          lab: ["alpha", "beta", "gamma"],
        },
        { x: "x", y: "y", label: "lab" },
      )
        .add(geomText({ size: 12 }))
        .add(geomLabel({ y: "y", size: 10 }))
        .build(),
  },
  {
    name: "line_step_area",
    build: () =>
      ggplot(
        { x: [1, 2, 3, 4], y: [3, 1, 4, 2] },
        { x: "x", y: "y" },
      )
        .add(geomArea({ fill: "#ddd" }))
        .add(geomLine())
        .add(geomStep({ direction: "hv" }))
        .build(),
  },
  {
    name: "stacked_area",
    build: () =>
      ggplot(
        {
          x: [1, 2, 3, 1, 2, 3],
          y: [2, 1, 2, 4, 3, 2],
          group: ["a", "a", "a", "b", "b", "b"],
        },
        { x: "x", y: "y", fill: "group" },
      ).add(geomArea({ position: "stack" })).build(),
  },
  {
    name: "boxplot_violin",
    build: () =>
      ggplot(
        {
          grp: ["a", "a", "a", "a", "b", "b", "b", "b"],
          v: [1, 2, 3, 10, 2, 3, 4, 12],
        },
        { x: "grp", y: "v" },
      )
        .add(geomBoxplot())
        .add(geomViolin())
        .build(),
  },
  {
    name: "interval_and_refs",
    build: () =>
      ggplot(
        {
          x: [1, 2, 3],
          y: [2, 4, 3],
          lo: [1, 3, 2],
          hi: [3, 5, 4],
        },
        { x: "x", ymin: "lo", ymax: "hi" },
      )
        .add(geomErrorbar())
        .add(geomHline({ yintercept: 3 }))
        .build(),
  },
  {
    name: "annotation_geoms",
    build: () =>
      ggplot({ x: [0, 5], y: [0, 5] }, { x: "x", y: "y" })
        .add(geomPoint())
        .add(annotate("segment", { x: 1, y: 1, xend: 4, yend: 4 }))
        .add(annotate("rect", { xmin: 1, xmax: 2, ymin: 1, ymax: 2 }))
        .add(geomCurve({
          mapping: { x: "x", y: "y", xend: "xend", yend: "yend" },
          inheritAes: false,
          data: { x: [0], y: [0], xend: [3], yend: [4] },
        }))
        .add(geomSpoke({
          mapping: { x: "x", y: "y", angle: "angle", radius: "radius" },
          inheritAes: false,
          data: { x: [2], y: [2], angle: [0.5], radius: [1.5] },
        }))
        .add(geomRug())
        .build(),
  },
  {
    name: "tile_polygon",
    build: () =>
      ggplot(
        {
          x: [1, 2, 1, 2],
          y: [1, 1, 2, 2],
          z: [0.1, 0.4, 0.7, 1.0],
        },
        { x: "x", y: "y", fill: "z" },
      )
        .add(geomTile())
        .add(geomPolygon({
          mapping: { x: "px", y: "py", group: "g" },
          inheritAes: false,
          data: {
            px: [0, 1, 0.5],
            py: [0, 0, 1],
            g: ["t", "t", "t"],
          },
        }))
        .build(),
  },
];

// Resident cases exercise the GPU-resident decision surface (compiled WITH
// options.resident). One eligible spec resolves to the standalone "view" form,
// one eligible spec to the inline mark form (explicit y domain), one eligible
// spec maps a default-scaled factor fill (per-group palette, standalone view),
// and one gated spec (a custom fill scale) must fall back to CPU Polygons.
// These pin the generic ResidentProduct node produced by
// GeomDefinition.residentPlan going forward.
export const residentCases: Array<{ name: string; build: () => Spec }> = [
  {
    name: "resident_histogram_view",
    build: () =>
      ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
        .add(geomHistogram({ binwidth: 2 }))
        .build(),
  },
  {
    name: "resident_histogram_mark",
    build: () =>
      ggplot({ x: [0, 1, 2, 3] }, { x: "x" })
        .add(geomHistogram({ binwidth: 2, fill: "#ff0000" }))
        .add(scaleYContinuous({ domain: [0, 4] }))
        .build(),
  },
  {
    name: "resident_histogram_fill",
    build: () =>
      ggplot(
        { x: [0, 1, 2, 3], cohort: ["a", "a", "b", "b"] },
        { x: "x", fill: "cohort" },
      )
        .add(geomHistogram({ binwidth: 2 }))
        .build(),
  },
  {
    name: "resident_tile_strip",
    build: () =>
      ggplot(
        { x: [0, 1, 2, 3], cohort: ["a", "a", "b", "b"] },
        { x: "x", fill: "cohort" },
      )
        // Explicit stat "bin" + factor fill rows: the resident tile-grid
        // (heatmap strip) standalone view (gggplot-ysq).
        .add(geomTile({ stat: "bin", bins: 2 }))
        .build(),
  },
  {
    name: "resident_histogram_cpu_fallback",
    build: () =>
      ggplot(
        { x: [0, 1, 2, 3], cohort: ["a", "a", "b", "b"] },
        { x: "x", fill: "cohort" },
      )
        // A user-declared fill scale gates the resident color path: this spec
        // must fall back to CPU ChunkedFace bars.
        .add(
          geomHistogram({ binwidth: 2 }),
          scaleFill({ range: ["#111111", "#222222"] }),
        )
        .build(),
  },
];

/** Where the saved RenderTree baselines live. Exported so the drift test
 * (packages/core/tests/geom_fixture_drift_test.ts) reads exactly the files
 * this script writes, rather than repeating the path. */
export const fixtureDir = new URL(
  "../packages/core/tests/fixtures/geom_registry/",
  import.meta.url,
);

// FlatTensor fixture encoding (gggplot-tzc.1). Nothing in the compiler emits
// FlatTensor/MarkTopology onto a RenderTree node yet (that lands in
// tzc.3/tzc.4), so this replacer is currently a no-op for every fixture
// case below — it exists so later beads don't need to touch the fixture
// harness or invalidate saved fixtures when they start emitting typed
// arrays. Float32Array values are rounded to 6 decimal places (well past
// float32 -> float64 round-trip noise, e.g. 0.1 -> 0.10000000149011612)
// so fixture diffs stay readable; Uint32Array values are exact integers.
export function serializeTypedArrays(_key: string, value: unknown): unknown {
  if (value instanceof Float32Array) {
    return { $f32: Array.from(value, (v) => Math.round(v * 1e6) / 1e6) };
  }
  if (value instanceof Uint32Array) {
    return { $u32: Array.from(value) };
  }
  return value;
}

function treeFor(build: () => Spec): unknown {
  // Compile both with and without layout so text/label measured boxes and the
  // panel-pixel-dependent geoms (rug, label) are exercised deterministically.
  return {
    plain: compile(build()),
    laidOut: compile(build(), { layout }),
  };
}

function treeForResident(build: () => Spec): unknown {
  return {
    plain: compile(build(), { resident: true }),
    laidOut: compile(build(), { resident: true, layout }),
  };
}

/** Compiles every case and serializes it exactly as the saved fixtures are
 * written. Exported so the drift test compares against the same bytes this
 * script would write — a check that re-derived the serialization could pass
 * while the on-disk baseline was stale. */
export function renderFixtures(): Array<{ name: string; json: string }> {
  return [
    ...cases.map(({ name, build }) => ({
      name,
      json: JSON.stringify(treeFor(build), serializeTypedArrays, 2),
    })),
    ...residentCases.map(({ name, build }) => ({
      name,
      json: JSON.stringify(treeForResident(build), serializeTypedArrays, 2),
    })),
  ];
}

// Guarded behind import.meta.main so serializeTypedArrays, renderFixtures, and
// the case tables above can be imported from tests without running the fixture
// read/write/compare side effects — e.g. packages/core/tests/mark_tensor_test.ts
// exercises the serializer in isolation.
if (import.meta.main) {
  const check = Deno.args.includes("--check");
  if (!check) await Deno.mkdir(fixtureDir, { recursive: true });

  let failures = 0;
  for (const { name, json } of renderFixtures()) {
    const file = new URL(`${name}.json`, fixtureDir);
    if (check) {
      const prev = await Deno.readTextFile(file);
      if (prev !== json) {
        failures++;
        console.error(`MISMATCH: ${name}`);
      } else {
        console.log(`ok: ${name}`);
      }
    } else {
      await Deno.writeTextFile(file, json);
      console.log(`wrote: ${name}`);
    }
  }

  if (check && failures > 0) {
    console.error(`\n${failures} fixture(s) differ from baseline`);
    Deno.exit(1);
  }
  if (check) console.log("\nAll fixtures deep-equal to baseline.");
}
