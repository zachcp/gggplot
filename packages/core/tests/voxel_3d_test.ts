import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { geomVoxel, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { applyStat } from "../src/stat/mod.ts";
import { columnValues } from "../src/data/mod.ts";
import type { DataFrame } from "../src/ir/types.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

const mapping = { x: "x", y: "y", z: "z" };
const values = (frame: DataFrame, column: string) =>
  columnValues(frame, column);

/** Eight observations, one per corner of a 2x2x2 lattice. */
const corners = {
  x: [0, 0, 0, 0, 1, 1, 1, 1],
  y: [0, 0, 1, 1, 0, 0, 1, 1],
  z: [0, 1, 0, 1, 0, 1, 0, 1],
};

const binned = (data: Record<string, unknown[]>, params: Record<string, unknown> = {}) =>
  applyStat(
    {
      geom: "voxel",
      stat: "bin3d",
      position: "identity",
      params: { bins: 2, ...params },
    } as never,
    mapping,
    data as never,
  );

Deno.test("only occupied cells are emitted", () => {
  // Eight corners of a 2x2x2 lattice fill every cell.
  assertEquals(values(binned(corners).data, "count").length, 8);

  // Collapse the data onto one corner: seven cells become empty and vanish
  // rather than appearing with a count of zero. Absence is not zero.
  const clustered = { x: [0, 0, 0], y: [0, 0, 0], z: [0, 0, 0] };
  const result = binned(clustered);
  assertEquals(values(result.data, "count"), [3]);
});

Deno.test("density divides by cell volume, not area", () => {
  // Two bins per axis over a unit extent gives cells of 0.5 on a side, so
  // volume is 0.125. Eight observations, one per cell:
  //   density = 1 / (8 * 0.125) = 1.0
  // An area divisor would give 1 / (8 * 0.25) = 0.5 — plausible, monotone in
  // count, and wrong by a factor with units of length.
  const densities = values(binned(corners).data, "density") as number[];
  assertEquals(densities.length, 8);
  for (const density of densities) {
    assertEquals(Number(density.toFixed(6)), 1);
  }
});

Deno.test("rows with a missing position are dropped, not binned as missing", () => {
  const holed = {
    x: [0, 1, Number.NaN],
    y: [0, 1, 0],
    z: [0, 1, 0],
  };
  const counts = values(binned(holed).data, "count") as number[];
  // Two finite rows survive; the NaN row is gone rather than forming a cell.
  assertEquals(counts.reduce((sum, count) => sum + count, 0), 2);
});

Deno.test("a degenerate axis collapses to one bin instead of dividing by zero", () => {
  const flat = { x: [0, 1], y: [0, 0], z: [0, 1] };
  const result = binned(flat);
  const widths = values(result.data, "binWidthY") as number[];
  assert(widths.every((w) => Number.isFinite(w) && w > 0));
});

Deno.test("stat_bin_3d rejects weights and incomplete mappings", () => {
  assertThrows(
    () => binned(corners, { weight: "w" }),
    TypeError,
    "does not support weights",
  );
  assertThrows(
    () =>
      applyStat(
        { geom: "voxel", stat: "bin3d", position: "identity", params: {} } as never,
        { x: "x", y: "y" } as never,
        corners as never,
      ),
    TypeError,
    "requires numeric x, y, and z mappings",
  );
});

Deno.test("voxels render one box per occupied cell", () => {
  const nodes = findNodes(
    compile(ggplot(corners, mapping).add(geomVoxel({ bins: 2 })).build()),
    "ChunkedFace",
  ).filter((node) =>
    (node.props.positions as { format?: string })?.format === "vec4"
  );
  assertEquals(nodes.length, 1);
  const topology = nodes[0].props.topology as { chunks: Uint32Array };
  // Eight cells, six faces each.
  assertEquals(topology.chunks.length, 48);
});

Deno.test("padding shrinks cells without moving them", () => {
  const spec = (padding?: number) =>
    ggplot(corners, mapping).add(geomVoxel({ bins: 2, ...(padding != null ? { padding } : {}) })).build();
  const extent = (padding?: number) => {
    const node = findNodes(compile(spec(padding)), "ChunkedFace").find((n) =>
      (n.props.positions as { format?: string })?.format === "vec4"
    )!;
    const array = (node.props.positions as { array: Float32Array }).array;
    const xs: number[] = [];
    for (let i = 0; i < 24; i += 4) xs.push(array[i]);
    return Math.max(...xs) - Math.min(...xs);
  };
  const full = extent();
  const padded = extent(0.5);
  assert(padded < full, `padded ${padded} should be under ${full}`);
  assertEquals(Number((padded / full).toFixed(4)), 0.5);
});
