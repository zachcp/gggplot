// gggplot-b7f: <GeomLayer> builds, for every registered geom, the layer the
// spec path builds, so the root's stat/train/lower stages see the same input.
import { assertEquals, assertThrows } from "@std/assert";
import { layerFromProps } from "../src/components/geom_layer.ts";

import { asFactor, ingest } from "../src/data/mod.ts";
import { GEOM_REGISTRY } from "../src/geom/mod.ts";
import type { GeomKind } from "../src/ir/types.ts";
import { ggplot } from "../src/dsl/mod.ts";
import { assembleTree } from "./support/assemble.ts";

Deno.test("every registry geom gets its registry defaults", () => {
  for (const [kind, def] of Object.entries(GEOM_REGISTRY)) {
    const layer = layerFromProps({ geom: kind as GeomKind });
    assertEquals(layer.geom, kind);
    assertEquals(layer.stat, def.defaultStat, kind);
    assertEquals(layer.position, def.defaultPosition ?? "identity", kind);
    assertEquals(layer.params, {}, kind);
  }
});

Deno.test("explicit stat/position win; the rest are params", () => {
  const layer = layerFromProps({
    geom: "bar",
    stat: "bin",
    position: "dodge",
    inheritAes: false,
    bins: 12,
    color: "red",
    key: undefined,
    children: [],
  });
  assertEquals(layer.stat, "bin");
  assertEquals(layer.position, "dodge");
  assertEquals(layer.inheritAes, false);
  assertEquals(layer.params, { bins: 12, color: "red" });
});

Deno.test("layer data is ingested with dataOptions", () => {
  const layer = layerFromProps({
    geom: "point",
    data: { x: [1, 2], g: ["b", "a"] },
    dataOptions: { columns: { g: asFactor(["b", "a"]) } },
  });
  assertEquals(
    layer.data,
    ingest({ x: [1, 2], g: ["b", "a"] }, {
      columns: { g: asFactor(["b", "a"]) },
    }),
  );
});

Deno.test("an unknown geom throws", () => {
  assertThrows(() => layerFromProps({ geom: "nope" as GeomKind }));
});

const BASE = { x: "x", y: "y" };
const INTERVAL = { x: "x", ymin: "ymin", ymax: "ymax", y: "y" };
/** The aesthetics a geom needs; the rest take `default`. */
const MAPPINGS: Record<string, Record<string, string>> = {
  default: {
    ...BASE,
    xmin: "xmin",
    xmax: "xmax",
    ymin: "ymin",
    ymax: "ymax",
    xend: "xend",
    yend: "yend",
    label: "label",
  },
  errorbar: INTERVAL,
  linerange: INTERVAL,
  pointrange: INTERVAL,
  crossbar: INTERVAL,
  spoke: { ...BASE, angle: "angle", radius: "radius" },
  surface: { ...BASE, z: "z" },
  voxel: { ...BASE, z: "z" },
};

Deno.test("every registry geom compiles from a GeomLayer-built layer", () => {
  // Enough columns for any geom's required aesthetics.
  // A complete 4 x 5 grid, so geom_surface has its height field.
  const n = 20;
  const seq = Array.from({ length: n }, (_, i) => i);
  const data = ingest({
    x: seq.map((i) => i % 4),
    y: seq.map((i) => Math.floor(i / 4)),
    z: seq.map((i) => i / 3),
    xmin: seq.map((i) => i % 4),
    xmax: seq.map((i) => (i % 4) + 0.5),
    ymin: seq.map((i) => (Math.floor(i / 4)) - 1),
    ymax: seq.map((i) => (Math.floor(i / 4)) + 1),
    xend: seq.map((i) => (i % 4) + 1),
    yend: seq.map((i) => (Math.floor(i / 4)) + 1),
    label: seq.map((i) => `p${i}`),
    angle: seq.map((i) => i / 2),
    radius: seq.map(() => 0.5),
  });
  const failures: string[] = [];
  for (const kind of Object.keys(GEOM_REGISTRY) as GeomKind[]) {
    const { spec } = ggplot(data, MAPPINGS[kind] ?? MAPPINGS.default);
    spec.layers.push(layerFromProps({ geom: kind }));
    try {
      assembleTree(spec);
    } catch (error) {
      failures.push(`${kind}: ${(error as Error).message}`);
    }
  }
  assertEquals(failures, []);
});
