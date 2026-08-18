import { assertEquals } from "@std/assert";
import {
  buildGeometryProduct,
  buildTensorContentProduct,
  ByteArrayTensorSource,
  type ModelDocument,
  type TensorSource,
} from "../src/mod.ts";

function f32(values: number[]): Uint8Array {
  return new Uint8Array(new Float32Array(values).buffer);
}

function model(
  shape: number[],
  byteLength = shape.reduce((count, value) => count * value, 1) * 4,
): ModelDocument {
  return {
    schema: "gggplot.model@1",
    id: "fixture",
    source: { id: "payload", format: "onnx", kind: "memory" },
    graphs: [{
      id: "main",
      inputs: [{ id: "input", tensorId: "input", dtype: "f32", shape: [1, 2] }],
      outputs: [{
        id: "output",
        tensorId: "output",
        dtype: "f32",
        shape: [1, 2],
      }],
      nodes: [
        {
          id: "input-node",
          kind: "input",
          inputs: [],
          outputs: [{
            id: "input",
            tensorId: "input",
            dtype: "f32",
            shape: [1, 2],
          }],
        },
        {
          id: "linear",
          kind: "operator",
          name: "projection",
          op: "Gemm",
          inputs: [{
            id: "input",
            tensorId: "input",
            dtype: "f32",
            shape: [1, 2],
          }, { id: "weights", tensorId: "weights", dtype: "f32", shape }],
          outputs: [{
            id: "output",
            tensorId: "output",
            dtype: "f32",
            shape: [1, 2],
          }],
          parameters: ["weights"],
        },
        {
          id: "output-node",
          kind: "output",
          inputs: [{
            id: "output",
            tensorId: "output",
            dtype: "f32",
            shape: [1, 2],
          }],
          outputs: [],
        },
      ],
      edges: [
        {
          id: "input-edge",
          from: "input-node",
          to: "linear",
          valueId: "input",
          tensorId: "input",
        },
        {
          id: "output-edge",
          from: "linear",
          to: "output-node",
          valueId: "output",
          tensorId: "output",
        },
      ],
    }],
    tensors: {
      input: { id: "input", dtype: "f32", shape: [1, 2], role: "input" },
      output: { id: "output", dtype: "f32", shape: [1, 2], role: "output" },
      weights: {
        id: "weights",
        dtype: "f32",
        shape,
        role: "parameter",
        byteLength,
        payload: {
          sourceId: "payload",
          byteOffset: 0,
          byteLength,
          encoding: "raw",
        },
        storage: {
          sourceId: "payload",
          byteOffset: 0,
          byteLength,
          dtype: "f32",
          shape,
          order: "row-major",
        },
        residency: {
          policy: "range",
          cacheKey: "weights",
          upload: "on-demand",
          readback: "explicit",
        },
      },
    },
  };
}

Deno.test("geometry product keeps ports, edges, labels, and IDs separate from tensor values", () => {
  const document = model([2, 2]);
  document.graphs[0].nodes[1].scopePath = ["encoder", "block-0"];
  const product = buildGeometryProduct(document);
  assertEquals(product.kind, "geom_loading");
  assertEquals(product.nodes.length, 3);
  assertEquals(product.edges.length, 2);
  assertEquals(product.ports.length, 5);
  assertEquals(
    product.labels.some((label) => label.targetId === "linear"),
    true,
  );
  assertEquals(
    product.entities.some((entity) => entity.tensorId === "weights"),
    true,
  );
  assertEquals(
    product.nodes.find((node) => node.nodeId === "linear")?.parameterCount,
    4,
  );
  assertEquals(product.blocks.some((block) => block.label === "encoder"), true);
  assertEquals(
    product.blocks.some((block) => block.label === "encoder/block-0"),
    true,
  );
});

Deno.test("tensor content chooses exact, bounded tile, downsample, and metadata products", async () => {
  const exactBytes = f32([1, 2, 3, 4]);
  const exact = await buildTensorContentProduct(
    model([2, 2]),
    new ByteArrayTensorSource("payload", "v1", exactBytes),
    { target: { kind: "tensor", tensorId: "weights" } },
  );
  assertEquals(exact.representation, "exact");
  assertEquals(exact.values, [1, 2, 3, 4]);

  const tileValues = Array.from({ length: 12 }, (_, index) => index);
  const tile = await buildTensorContentProduct(
    model([3, 4]),
    new ByteArrayTensorSource("payload", "v1", f32(tileValues)),
    {
      target: { kind: "tensor", tensorId: "weights" },
      axes: [0, 1],
      mode: "tile",
      tile: { rowStart: 1, rowCount: 2, columnStart: 1, columnCount: 2 },
    },
  );
  assertEquals(tile.representation, "tile");
  assertEquals(tile.values, [5, 6, 9, 10]);

  const downsample = await buildTensorContentProduct(
    model([4, 4]),
    new ByteArrayTensorSource(
      "payload",
      "v1",
      f32(Array.from({ length: 16 }, (_, index) => index)),
    ),
    {
      target: { kind: "tensor", tensorId: "weights" },
      budget: { maxExactBytes: 8, maxOverviewCells: 4 },
    },
  );
  assertEquals(downsample.representation, "downsample");
  assertEquals(downsample.gridShape, [2, 2]);

  const unknown = structuredClone(model([2, 2]));
  unknown.tensors.weights.shape = [{ unknown: true }];
  const metadata = await buildTensorContentProduct(
    unknown,
    new ByteArrayTensorSource("payload", "v1", exactBytes),
    { target: { kind: "tensor", tensorId: "weights" } },
  );
  assertEquals(metadata.representation, "metadata");
});

Deno.test("large content summaries use only a bounded number of source reads", async () => {
  let reads = 0;
  const source: TensorSource = {
    id: "payload",
    version: "v1",
    byteLength: 64 * 1024 * 1024,
    readRange: async (request) => {
      reads++;
      return new ArrayBuffer(request.byteLength);
    },
  };
  const product = await buildTensorContentProduct(
    model([4096, 4096], 64 * 1024 * 1024),
    source,
    {
      target: { kind: "tensor", tensorId: "weights" },
      budget: { maxSummarySamples: 7 },
    },
  );
  assertEquals(product.representation, "summary");
  assertEquals(product.summary?.count, 7);
  assertEquals(reads, 7);
});

Deno.test("forced exact and downsample modes still respect content budgets", async () => {
  const source: TensorSource = {
    id: "payload",
    version: "v1",
    byteLength: 64,
    readRange: async (request) => new ArrayBuffer(request.byteLength),
  };
  const exact = await buildTensorContentProduct(model([4, 4]), source, {
    target: { kind: "tensor", tensorId: "weights" },
    mode: "exact",
    budget: { maxExactBytes: 8 },
  });
  assertEquals(exact.representation, "summary");
  const downsample = await buildTensorContentProduct(model([4, 4]), source, {
    target: { kind: "tensor", tensorId: "weights" },
    mode: "downsample",
    budget: { maxDownsampleReadBytes: 8 },
  });
  assertEquals(downsample.representation, "summary");
});
