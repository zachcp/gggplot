import { assertEquals } from "@std/assert";
import {
  buildGeometryProduct,
  buildTensorContentProduct,
  ByteArrayTensorSource,
  type ModelDocument,
  narrowF64ToF32,
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
    // deno-lint-ignore require-await -- stubs the async TensorSource.
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

Deno.test("small content summaries read the payload once and sample the same values", async () => {
  // 4096 f32 values 0..4095 fit one 1 MiB block, so 2048 samples need one read.
  const values = Float32Array.from({ length: 4096 }, (_, index) => index);
  const bytes = new ByteArrayTensorSource(
    "payload",
    "v1",
    new Uint8Array(values.buffer),
  );
  let reads = 0;
  const source: TensorSource = {
    id: bytes.id,
    version: bytes.version,
    byteLength: bytes.byteLength,
    readRange: (request) => {
      reads++;
      return bytes.readRange(request);
    },
  };
  const product = await buildTensorContentProduct(model([4096]), source, {
    target: { kind: "tensor", tensorId: "weights" },
    mode: "summary",
    budget: { maxSummarySamples: 2048 },
  });
  assertEquals(reads, 1);
  assertEquals(product.summary?.count, 2048);
  // Evenly spaced samples are the even indices: 0, 2, ..., 4094.
  assertEquals(product.summary?.min, 0);
  assertEquals(product.summary?.max, 4094);
  assertEquals(product.summary?.mean, 2047);
});

Deno.test("forced exact and downsample modes still respect content budgets", async () => {
  const source: TensorSource = {
    id: "payload",
    version: "v1",
    byteLength: 64,
    // deno-lint-ignore require-await -- stubs the async TensorSource.
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

Deno.test("forced content modes remain metadata-only without content prerequisites", async () => {
  const document = model([2, 2]);
  document.tensors.weights.shape = [{ unknown: true }];
  delete document.tensors.weights.payload;
  delete document.tensors.weights.storage;
  for (const mode of ["exact", "tile", "downsample", "summary"] as const) {
    const product = await buildTensorContentProduct(document, new Map(), {
      target: { kind: "tensor", tensorId: "weights" },
      mode,
    });
    assertEquals(product.representation, "metadata", mode);
  }
});

function narrow(value: number): number {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value, true);
  return narrowF64ToF32(new DataView(buffer), 0);
}

Deno.test("narrowF64ToF32 matches Math.fround everywhere outside the f32-subnormal underflow sliver", () => {
  // gggplot-vs7.14's stated policy: round-to-nearest-even and overflow are
  // identical to native f32 rounding, but underflow flushes to zero instead
  // of producing an f32 subnormal (Math.fround performs gradual underflow;
  // this function deliberately does not -- see narrowF64ToF32's doc comment).
  const f32SubnormalBoundary = 1.1754943508222875e-38; // smallest normal f32
  const cases = [
    0,
    -0,
    1,
    -1,
    1.5,
    -2.25,
    3.125,
    4,
    100,
    -200,
    Math.PI,
    Math.E,
    1 / 3,
    -0.1,
    123456789.123456,
    Number.MAX_VALUE,
    -Number.MAX_VALUE,
    3.4028234663852886e38, // just at the f32 max
    3.4028236e38, // just past it -- exercises overflow-to-infinity
    Infinity,
    -Infinity,
    NaN,
  ];
  for (const value of cases) {
    const actual = narrow(value);
    const expected = Math.fround(value);
    if (Number.isNaN(expected)) {
      assertEquals(Number.isNaN(actual), true, `${value}`);
    } else {
      assertEquals(Object.is(actual, expected), true, `${value}`);
    }
  }
  // A wide pseudo-random sweep of magnitudes and signs, skipping the sliver
  // where the two policies are expected to diverge (underflow-to-subnormal).
  let seed = 42;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 5000; i++) {
    const exponent = (random() - 0.5) * 80;
    const value = (random() * 2 - 1) * 10 ** exponent;
    if (Math.abs(value) > 0 && Math.abs(value) < f32SubnormalBoundary) continue;
    assertEquals(
      Object.is(narrow(value), Math.fround(value)),
      true,
      `${value}`,
    );
  }
});

Deno.test("narrowF64ToF32 flushes an f32-subnormal result to a signed zero", () => {
  assertEquals(Object.is(narrow(1e-40), 0), true);
  assertEquals(Object.is(narrow(-1e-40), -0), true);
  assertEquals(Object.is(narrow(5e-324), 0), true);
  // Confirms the two policies really do diverge here, so the test above isn't
  // vacuously skipping a range where they'd have agreed anyway.
  assertEquals(Math.fround(1e-40) === 0, false);
});
