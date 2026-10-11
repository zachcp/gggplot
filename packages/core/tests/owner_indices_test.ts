// gggplot-8e1: every vertex of a mark carries the prepared-data row it came
// from. Property: the CPU-packed color at vertex i equals the trained scale
// applied to the color column at owners[i], and for families whose vertices
// are data points, its x position is that row's scaled x. This is the contract
// a GPU scale binding relies on (getValue(getOwner(i))).
import { assert, assertAlmostEquals, assertEquals } from "@std/assert";
import {
  compile,
  type FlatTensor,
  type LowerMarksArgs,
  type RenderNode,
} from "../src/compile/mod.ts";
import { lowerLayer } from "../src/geom/mod.ts";
import {
  geomArea,
  geomBar,
  geomLine,
  geomPoint,
  geomPolygon,
  geomRibbon,
  geomStep,
  geomTile,
  ggplot,
} from "../src/dsl/mod.ts";
import { parseColorRGBA } from "../src/color/mod.ts";
import { scaleColorValue, scalePosition } from "../src/scale/mapping.ts";
import type { GGSpec } from "../src/ir/types.ts";

interface Lowered {
  args: LowerMarksArgs;
  nodes: RenderNode[];
}

function lowered(spec: GGSpec): Lowered[] {
  const out: Lowered[] = [];
  compile(spec, {
    lowerMarks: (args) => {
      const nodes = lowerLayer(args.layer, args.mapping, args.data, args.ctx);
      out.push({ args, nodes });
      return nodes;
    },
  });
  return out;
}

/** Asserts the owner property for every owner-carrying mark in `spec`. */
function checkOwners(
  spec: GGSpec,
  colorAes: "color" | "fill",
  options: { positions?: boolean } = {},
) {
  const layers = lowered(spec);
  let checked = 0;
  for (const { args, nodes } of layers) {
    const column = args.mapping[colorAes] as string;
    const scale = args.ctx.scales[colorAes];
    const values = args.data[column].values;
    for (const mark of nodes) {
      const positions = mark.props.positions as FlatTensor;
      const owners = mark.owners;
      assert(owners, `${mark.component} carries owners`);
      assertEquals(owners.length, positions.length, "one owner per vertex");
      const colors = mark.props.colors as FlatTensor;
      for (let i = 0; i < owners.length; i++) {
        assert(owners[i] < values.length, "owner is a prepared-data row");
        const want = parseColorRGBA(scaleColorValue(scale, values[owners[i]]));
        for (let c = 0; c < 3; c++) {
          assertAlmostEquals(colors.array[i * 4 + c], want[c], 1e-6);
        }
        if (options.positions) {
          const x = args.data[args.mapping.x as string].values[owners[i]];
          assertAlmostEquals(
            positions.array[i * positions.dims],
            Math.fround(scalePosition(args.ctx.scales.x, x)),
            1e-5,
          );
        }
        checked++;
      }
    }
  }
  assert(checked > 0, "some vertices were checked");
}

const rows = {
  x: [3, 1, 4, 1.5, 5, 2],
  y: [2, 7, 1, 8, 2, 8],
  v: [0.1, 0.9, 0.4, 0.6, 0.2, 0.8],
  g: ["a", "b", "a", "b", "a", "b"],
  lo: [0, 1, 0, 1, 0, 1],
};

Deno.test("points: a continuous color reads through owners", () => {
  // A NaN position is dropped by the packer: owners must skip it too.
  const withMissing = { ...rows, y: [2, 7, Number.NaN, 8, 2, 8] };
  checkOwners(
    ggplot(withMissing, { x: "x", y: "y", color: "v" }).add(geomPoint())
      .build(),
    "color",
    { positions: true },
  );
});

Deno.test("lines and steps: sorted, grouped and step-expanded", () => {
  const spec = (layer: ReturnType<typeof geomLine>) =>
    ggplot(rows, { x: "x", y: "y", color: "g" }).add(layer).build();
  checkOwners(spec(geomLine()), "color", { positions: true });
  for (const direction of ["hv", "vh", "mid"]) {
    checkOwners(spec(geomStep({ direction })), "color");
  }
});

Deno.test("bars: stacked and dodged bars own their rows", () => {
  for (const position of ["stack", "dodge", "dodge2"] as const) {
    checkOwners(
      ggplot(rows, { x: "x", y: "y", fill: "g" }).add(
        geomBar({ stat: "identity", position }),
      ).build(),
      "fill",
    );
  }
});

Deno.test("areas and ribbons: both edges, in band order", () => {
  checkOwners(
    ggplot(rows, { x: "x", y: "y", fill: "g" }).add(geomArea()).build(),
    "fill",
    { positions: true },
  );
  checkOwners(
    ggplot(rows, { x: "x", y: "y", fill: "g" }).add(
      geomArea({ position: "identity" }),
    ).build(),
    "fill",
    { positions: true },
  );
  checkOwners(
    ggplot(rows, { x: "x", ymin: "lo", ymax: "y", fill: "g" }).add(
      geomRibbon(),
    ).build(),
    "fill",
    { positions: true },
  );
});

Deno.test("tiles and polygons", () => {
  checkOwners(
    ggplot(rows, { x: "x", y: "y", fill: "v" }).add(geomTile()).build(),
    "fill",
  );
  checkOwners(
    ggplot(rows, { x: "x", y: "y", fill: "g" }).add(geomPolygon()).build(),
    "fill",
    { positions: true },
  );
});
