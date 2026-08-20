import { assertEquals } from "@std/assert";
import { buildModelScene3D, type ModelDocument } from "../src/mod.ts";

const document: ModelDocument = {
  schema: "gggplot.model@1",
  id: "three-d-fixture",
  source: { id: "fixture.onnx", format: "onnx", kind: "memory" },
  graphs: [{
    id: "main",
    inputs: [{ id: "input", tensorId: "input", dtype: "f32", shape: [1, 4] }],
    outputs: [{
      id: "output",
      tensorId: "output",
      dtype: "f32",
      shape: [1, 2],
    }],
    nodes: [
      {
        id: "in",
        kind: "input",
        inputs: [],
        outputs: [{ id: "input", tensorId: "input" }],
      },
      {
        id: "linear",
        kind: "operator",
        op: "Gemm",
        inputs: [{ id: "input", tensorId: "input" }, {
          id: "weight",
          tensorId: "weight",
        }],
        outputs: [{ id: "hidden", tensorId: "hidden" }],
        parameters: ["weight"],
      },
      {
        id: "out",
        kind: "output",
        inputs: [{ id: "hidden", tensorId: "hidden" }],
        outputs: [],
      },
    ],
    edges: [
      {
        id: "input",
        from: "in",
        to: "linear",
        valueId: "input",
        tensorId: "input",
      },
      {
        id: "output",
        from: "linear",
        to: "out",
        valueId: "hidden",
        tensorId: "hidden",
      },
    ],
  }],
  tensors: {
    input: { id: "input", dtype: "f32", shape: [1, 4], role: "input" },
    hidden: { id: "hidden", dtype: "f32", shape: [1, 2], role: "activation" },
    output: { id: "output", dtype: "f32", shape: [1, 2], role: "output" },
    weight: {
      id: "weight",
      dtype: "f32",
      shape: [32, 16],
      role: "parameter",
      payload: {
        sourceId: "fixture.onnx",
        byteOffset: 128,
        byteLength: 2048,
        encoding: "onnx",
      },
      residency: {
        policy: "range",
        cacheKey: "weight",
        upload: "on-demand",
        readback: "explicit",
      },
    },
  },
};

Deno.test("3D scene separates tensor slabs, modules, and connector routes", () => {
  const scene = buildModelScene3D(document, {
    maxTileRows: 8,
    maxTileColumns: 12,
  });
  assertEquals(scene.modules.length, 3);
  assertEquals(scene.connectors.length, 2);
  const parameter = scene.slabs.find((slab) => slab.tensorId === "weight")!;
  assertEquals(parameter.kind, "parameter");
  assertEquals(parameter.displayShape, [8, 12]);
  assertEquals(parameter.source?.byteOffset, 128);
  assertEquals(scene.connectors[0].points.length, 10);
  // Every route segment changes at most one axis: dense scenes retain their
  // spatial topology instead of becoming a web of diagonal chords.
  for (let index = 1; index < scene.connectors[0].points.length; index++) {
    const previous = scene.connectors[0].points[index - 1];
    const current = scene.connectors[0].points[index];
    const changedAxes = current.filter((value, axis) =>
      value !== previous[axis]
    )
      .length;
    assertEquals(changedAxes <= 1, true);
  }
  assertEquals(
    scene.entities.some((entity) => entity.tensorId === "weight"),
    true,
  );
});
