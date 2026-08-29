import { assertEquals } from "@std/assert";
import {
  geomBar,
  geomPoint,
  ggplot,
  scaleXContinuous,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { facetWrap } from "../src/dsl/mod.ts";
import type { RenderNode, RowRemoval } from "../src/compile/rendertree.ts";

/**
 * gggplot-9v6: rows dropped before the stat must be reportable.
 *
 * ggplot2 says "Removed N rows containing missing values" / "...non-finite
 * values". gggplot compiles to a serializable tree instead of running in a
 * REPL, so the counts ride on the root node where a test or tool can read
 * them, and are ALSO warned to the console to match scale/palette.ts.
 */

/** Compile with console.warn captured, so assertions can cover both channels. */
function compileQuietly(
  spec: Parameters<typeof compile>[0],
): { tree: RenderNode; warnings: string[] } {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
  try {
    return { tree: compile(spec) as RenderNode, warnings };
  } finally {
    console.warn = original;
  }
}

const diagnostics = (tree: RenderNode): RowRemoval[] =>
  (tree.props.diagnostics as RowRemoval[] | undefined) ?? [];

Deno.test("a plot that drops no rows reports nothing", () => {
  const { tree, warnings } = compileQuietly(
    ggplot({ x: [0, 1, 2], y: [0, 1, 2] }, { x: "x", y: "y" })
      .add(geomPoint()).build(),
  );
  assertEquals("diagnostics" in tree.props, false);
  assertEquals(warnings, []);
});

Deno.test("rows outside scale limits are reported as non-finite removals", () => {
  const { tree, warnings } = compileQuietly(
    ggplot({ x: [0, 1, 50, 99], y: [0, 1, 2, 3] }, { x: "x", y: "y" })
      .add(geomPoint(), scaleXContinuous({ domain: [0, 10] })).build(),
  );
  assertEquals(diagnostics(tree), [
    { layer: 0, geom: "point", reason: "outside-limits", rows: 2 },
  ]);
  assertEquals(warnings.length, 1);
  assertEquals(
    warnings[0],
    "[gggplot] Removed 2 rows containing non-finite values (point)",
  );
});

Deno.test("rows with no position are reported as missing-value removals", () => {
  const { tree, warnings } = compileQuietly(
    ggplot(
      { x: [0, null, 2], y: [0, 1, NaN] } as never,
      { x: "x", y: "y" },
    ).add(geomPoint()).build(),
  );
  assertEquals(diagnostics(tree), [
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
  const { tree } = compileQuietly(
    ggplot(
      { x: [0, null, 50, 1], y: [0, 1, 2, 3] } as never,
      { x: "x", y: "y" },
    ).add(geomPoint(), scaleXContinuous({ domain: [0, 10] })).build(),
  );
  assertEquals(diagnostics(tree), [
    { layer: 0, geom: "point", reason: "missing-position", rows: 1 },
    { layer: 0, geom: "point", reason: "outside-limits", rows: 1 },
  ]);
});

Deno.test("a row is never counted twice", () => {
  // A null row is ALSO outside any finite limit. It must be attributed once,
  // to missing-position, because that filter runs first and the row is gone
  // before the limits filter sees it.
  const { tree } = compileQuietly(
    ggplot(
      { x: [0, null, null], y: [0, 1, 2] } as never,
      { x: "x", y: "y" },
    ).add(geomPoint(), scaleXContinuous({ domain: [0, 10] })).build(),
  );
  const total = diagnostics(tree).reduce((sum, r) => sum + r.rows, 0);
  assertEquals(total, 2, "two rows dropped, two rows reported");
  assertEquals(diagnostics(tree).map((r) => r.reason), ["missing-position"]);
});

Deno.test("counts are per layer, summed across facet panels", () => {
  // Three panels each drop one row from the same layer. ggplot2 reports one
  // removal for the layer, not one per panel.
  const { tree, warnings } = compileQuietly(
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
  assertEquals(diagnostics(tree), [
    { layer: 0, geom: "point", reason: "outside-limits", rows: 3 },
  ]);
  assertEquals(warnings.length, 1, "one warning for the layer, not one each");
});

Deno.test("each layer is reported separately", () => {
  const { tree } = compileQuietly(
    ggplot({ x: [0, 50, 99], y: [1, 2, 3] }, { x: "x", y: "y" })
      .add(geomPoint(), geomBar(), scaleXContinuous({ domain: [0, 10] }))
      .build(),
  );
  assertEquals(diagnostics(tree).map((r) => [r.layer, r.geom, r.rows]), [
    [0, "point", 2],
    [1, "bar", 2],
  ]);
});

Deno.test("diagnostics survive JSON serialization", () => {
  // The whole reason the counts live on the tree rather than only in a warning
  // is that the tree is the serializable artifact.
  const { tree } = compileQuietly(
    ggplot({ x: [0, 50], y: [0, 1] }, { x: "x", y: "y" })
      .add(geomPoint(), scaleXContinuous({ domain: [0, 10] })).build(),
  );
  const roundTripped = JSON.parse(JSON.stringify(tree)) as RenderNode;
  assertEquals(diagnostics(roundTripped), diagnostics(tree));
});
