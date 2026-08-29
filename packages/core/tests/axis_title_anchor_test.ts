import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import { geomPoint, ggplot, labels as labelsOf } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { approximateTextMeasurer } from "../src/render/font_resources.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

/**
 * gggplot-1wj: the axis titles were anchored by magic fractions of the margin
 * (0.3 of the left gap, 0.7 of the bottom gap) rather than by the bands
 * guideLayout already reserves for them.
 *
 * Measured before the fix, at 912x600 with y label "KiB": the y title sat at
 * 17.2px when its own reservation put it at 25.7px, and the error grew with
 * the label, so a long label ran off the canvas entirely. The x title sat at
 * 587.4px, ~12px below its band and inside the outer margin.
 *
 * These pin the anchors to the reservation, which is the only definition that
 * stays correct as the label changes.
 */

const WIDTH = 912;
const HEIGHT = 600;
/** guideLayout's own constants for the outer margins it reserves. */
const LEFT_MARGIN = 14;
const BOTTOM_MARGIN = 18;
/** theme.fontSize default, which guideLayout uses as the title size. */
const TITLE_SIZE = 13;

/** approximateTextMeasurer is width = length * size * 0.6, height = size. */
const bandWidth = (text: string) => text.length * TITLE_SIZE * 0.6;

const toPx = (ndc: number, size: number) => (ndc + 1) / 2 * size;

function labelNodes(node: RenderNode, out: RenderNode[] = []): RenderNode[] {
  if (node.component === "Label") out.push(node);
  for (const child of node.children) labelNodes(child, out);
  return out;
}

/** Centre of the single Label node whose text is `text`, in canvas pixels. */
function centreOf(tree: RenderNode, text: string): { x: number; y: number } {
  for (const label of labelNodes(tree)) {
    const texts = label.props.labels as string[];
    const index = texts.indexOf(text);
    if (index === -1) continue;
    const [x, y] = (label.props.positions as [number, number][])[index];
    return { x: toPx(x, WIDTH), y: toPx(y, HEIGHT) };
  }
  throw new Error(`no Label node carrying ${JSON.stringify(text)}`);
}

function specFor(yLabel: string, xLabel: string) {
  return ggplot({ x: [0, 1, 2], y: [0, 1, 2] }, { x: "x", y: "y" })
    .add(geomPoint(), labelsOf({ x: xLabel, y: yLabel })).build();
}

function plot(yLabel: string, xLabel = "seconds"): RenderNode {
  return compile(specFor(yLabel, xLabel), {
    layout: {
      width: WIDTH,
      height: HEIGHT,
      measureText: approximateTextMeasurer,
    },
  }) as RenderNode;
}

/** No layout at all, which is how guideLayout's unmeasured path is reached. */
function unmeasuredPlot(yLabel: string, xLabel = "seconds"): RenderNode {
  return compile(specFor(yLabel, xLabel)) as RenderNode;
}

Deno.test("the y title is centred in the band reserved for it", () => {
  const title = "KiB";
  const centre = centreOf(plot(title), title);
  assertAlmostEquals(centre.x, LEFT_MARGIN + bandWidth(title) / 2, 0.01);
});

Deno.test("the y title starts exactly at the left margin, not left of it", () => {
  // The old anchor put "KiB" at 17.2px, so its left edge was 5.5px -- inside
  // the margin the layout reserved for whitespace.
  for (const title of ["KiB", "Throughput", "Bytes per second, cumulative"]) {
    const centre = centreOf(plot(title), title);
    assertAlmostEquals(
      centre.x - bandWidth(title) / 2,
      LEFT_MARGIN,
      0.01,
      `${title} left edge`,
    );
  }
});

Deno.test("a long y title stays on the canvas", () => {
  // The failure the bead reported: the old anchor moved right far slower than
  // the label grew, so past roughly 38px of label the title left the canvas.
  const title = "Cumulative bytes transferred per second";
  const centre = centreOf(plot(title), title);
  assert(
    centre.x - bandWidth(title) / 2 >= 0,
    `left edge ${centre.x - bandWidth(title) / 2} is off-canvas`,
  );
  assert(centre.x + bandWidth(title) / 2 <= WIDTH, "right edge is off-canvas");
});

Deno.test("the y title does not overlap the y tick labels", () => {
  const title = "Throughput";
  const tree = plot(title);
  const titleRight = centreOf(tree, title).x + bandWidth(title) / 2;
  // Tick labels are the next band inward; their centres must sit beyond the
  // title's band. Placement 'left' would have started the title at its anchor
  // and run it INTO this band, which is why the anchor itself had to move.
  const tick = centreOf(tree, "0").x;
  assert(
    tick > titleRight,
    `tick labels at ${tick} overlap the title band ending at ${titleRight}`,
  );
});

Deno.test("the x title is centred in its own reserved band", () => {
  // Mirrors the y case: bottomPx = 18 + xTickHeight + xTitleHeight, with the
  // title band sitting just inside the 18px margin.
  const centre = centreOf(plot("KiB", "seconds"), "seconds");
  assertAlmostEquals(
    centre.y,
    HEIGHT - BOTTOM_MARGIN - TITLE_SIZE / 2,
    0.01,
  );
});

Deno.test("the x title sits inside the canvas, not in the outer margin", () => {
  const centre = centreOf(plot("KiB", "seconds"), "seconds");
  assert(
    centre.y + TITLE_SIZE / 2 <= HEIGHT - BOTTOM_MARGIN,
    "x title bottom edge intrudes into the reserved outer margin",
  );
});

Deno.test("without a text measurer the old heuristic still applies", () => {
  // There are no bands to anchor to when nothing can be measured, so the
  // pre-fix fractions remain the best available guess. Pinned in NDC (there is
  // no canvas size on this path) so the fallback is a decision, not an
  // accident.
  const tree = unmeasuredPlot("KiB");
  for (const label of labelNodes(tree)) {
    const texts = label.props.labels as string[];
    const index = texts.indexOf("KiB");
    if (index === -1) continue;
    const [x] = (label.props.positions as [number, number][])[index];
    const defaultLeft = -0.72; // DEFAULT_PANEL_BOUNDS left
    assertAlmostEquals(x, -1 + (defaultLeft + 1) * 0.3, 1e-9);
    return;
  }
  throw new Error("no y title on the unmeasured path");
});

Deno.test("anchors do not disturb the panel bounds", () => {
  // The fix must move labels only. If it moved the panel, every mark would
  // shift with it and the fixtures would drift.
  const tree = plot("KiB");
  const viewport = (function find(n: RenderNode): RenderNode | undefined {
    if (n.component === "PanelViewport") return n;
    for (const c of n.children) {
      const hit = find(c);
      if (hit) return hit;
    }
  })(tree);
  assert(viewport, "expected a PanelViewport");
  const [left] = viewport.props.bounds as [number, number, number, number];
  // leftPx = 14 + yTickWidth + yTitleBand, unchanged by the anchor work.
  assertEquals(toPx(left, WIDTH) > LEFT_MARGIN + bandWidth("KiB"), true);
});
