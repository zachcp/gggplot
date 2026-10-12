import { assertEquals } from "@std/assert";
import {
  geomBar,
  geomPoint,
  ggplot,
  scaleXContinuous,
} from "../src/dsl/mod.ts";

import { facetWrap } from "../src/dsl/mod.ts";
import type { RowRemoval } from "../src/compile/rendertree.ts";
import type { GGSpec } from "../src/ir/types.ts";
import { assemble } from "./support/assemble.ts";
import { warnRowRemovals } from "../src/compile/mod.ts";

/**
 * gggplot-9v6: rows dropped before the stat must be reportable.
 *
 * ggplot2 says "Removed N rows containing missing values" / "...non-finite
 * values". gggplot is not a REPL, so the component root returns the counts
 * (and reports them through <GGPlot onDiagnostics>), and ALSO warns them to
 * the console to match scale/palette.ts.
 */

/**
 * Assemble through the component root, and warn its removals the way the
 * root does (warnRowRemovals), with console.warn captured so assertions can
 * cover both channels.
 */
function assembleQuietly(
  spec: GGSpec,
): { removals: readonly RowRemoval[]; warnings: string[] } {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
  try {
    const { diagnostics } = assemble(spec);
    warnRowRemovals(diagnostics);
    return { removals: diagnostics, warnings };
  } finally {
    console.warn = original;
  }
}

Deno.test("a plot that drops no rows reports nothing", () => {
  const { removals, warnings } = assembleQuietly(
    ggplot({ x: [0, 1, 2], y: [0, 1, 2] }, { x: "x", y: "y" })
      .add(geomPoint()).build(),
  );
  assertEquals(removals, []);
  assertEquals(warnings, []);
});

Deno.test("rows outside scale limits are reported as non-finite removals", () => {
  const { removals, warnings } = assembleQuietly(
    ggplot({ x: [0, 1, 50, 99], y: [0, 1, 2, 3] }, { x: "x", y: "y" })
      .add(geomPoint(), scaleXContinuous({ domain: [0, 10] })).build(),
  );
  assertEquals(removals, [
    { layer: 0, geom: "point", reason: "outside-limits", rows: 2 },
  ]);
  assertEquals(warnings.length, 1);
  assertEquals(
    warnings[0],
    "[gggplot] Removed 2 rows containing non-finite values (point)",
  );
});

Deno.test("rows with no position are reported as missing-value removals", () => {
  const { removals, warnings } = assembleQuietly(
    ggplot(
      { x: [0, null, 2], y: [0, 1, NaN] } as never,
      { x: "x", y: "y" },
    ).add(geomPoint()).build(),
  );
  assertEquals(removals, [
    { layer: 0, geom: "point", reason: "missing-position", rows: 2 },
  ]);
  assertEquals(
    warnings[0],
    "[gggplot] Removed 2 rows containing missing values (point)",
  );
});

Deno.test("the two reasons stay distinguishable in one plot", () => {
  // One row is null (never plottable) and one is out of limits (excluded by
  // choice). ggplot2 reports these separately and so must this.
  const { removals } = assembleQuietly(
    ggplot(
      { x: [0, null, 50, 1], y: [0, 1, 2, 3] } as never,
      { x: "x", y: "y" },
    ).add(geomPoint(), scaleXContinuous({ domain: [0, 10] })).build(),
  );
  assertEquals(removals, [
    { layer: 0, geom: "point", reason: "missing-position", rows: 1 },
    { layer: 0, geom: "point", reason: "outside-limits", rows: 1 },
  ]);
});

Deno.test("a row is never counted twice", () => {
  // A null row is ALSO outside any finite limit. It must be attributed once,
  // to missing-position, because that filter runs first and the row is gone
  // before the limits filter sees it.
  const { removals } = assembleQuietly(
    ggplot(
      { x: [0, null, null], y: [0, 1, 2] } as never,
      { x: "x", y: "y" },
    ).add(geomPoint(), scaleXContinuous({ domain: [0, 10] })).build(),
  );
  const total = removals.reduce((sum, r) => sum + r.rows, 0);
  assertEquals(total, 2, "two rows dropped, two rows reported");
  assertEquals(removals.map((r) => r.reason), ["missing-position"]);
});

Deno.test("counts are per layer, summed across facet panels", () => {
  // Three panels each drop one row from the same layer. ggplot2 reports one
  // removal for the layer, not one per panel.
  const { removals, warnings } = assembleQuietly(
    ggplot(
      {
        x: [0, 50, 0, 50, 0, 50],
        y: [0, 1, 2, 3, 4, 5],
        g: ["a", "a", "b", "b", "c", "c"],
      },
      { x: "x", y: "y" },
    ).add(geomPoint(), scaleXContinuous({ domain: [0, 10] }), facetWrap(["g"]))
      .build(),
  );
  assertEquals(removals, [
    { layer: 0, geom: "point", reason: "outside-limits", rows: 3 },
  ]);
  assertEquals(warnings.length, 1, "one warning for the layer, not one each");
});

Deno.test("each layer is reported separately", () => {
  const { removals } = assembleQuietly(
    ggplot({ x: [0, 50, 99], y: [1, 2, 3] }, { x: "x", y: "y" })
      .add(geomPoint(), geomBar(), scaleXContinuous({ domain: [0, 10] }))
      .build(),
  );
  assertEquals(removals.map((r) => [r.layer, r.geom, r.rows]), [
    [0, "point", 2],
    [1, "bar", 2],
  ]);
});

Deno.test("diagnostics are plain data", () => {
  // They reach a host through <GGPlot onDiagnostics> and may be logged or
  // sent on, so they must round-trip through JSON unchanged.
  const { removals } = assembleQuietly(
    ggplot({ x: [0, 50], y: [0, 1] }, { x: "x", y: "y" })
      .add(geomPoint(), scaleXContinuous({ domain: [0, 10] })).build(),
  );
  assertEquals(removals.length, 1);
  assertEquals(JSON.parse(JSON.stringify(removals)), removals);
});
