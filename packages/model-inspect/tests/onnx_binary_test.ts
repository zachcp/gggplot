import { assertEquals, assertThrows } from "@std/assert";
import {
  inspectOnnx,
  OnnxFormatError,
  validateModelDocument,
} from "../src/mod.ts";

const encoder = new TextEncoder();

function varint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  do {
    const next = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    bytes.push(remaining ? next | 0x80 : next);
  } while (remaining);
  return bytes;
}

function field(number: number, value: Uint8Array): Uint8Array {
  return new Uint8Array([
    ...varint((number << 3) | 2),
    ...varint(value.length),
    ...value,
  ]);
}

function integer(number: number, value: number): Uint8Array {
  return new Uint8Array([...varint(number << 3), ...varint(value)]);
}

function message(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function text(number: number, value: string): Uint8Array {
  return field(number, encoder.encode(value));
}

function tinyOnnx(): Uint8Array {
  const initializer = message(
    integer(1, 2),
    integer(1, 2),
    integer(2, 1),
    text(8, "weights"),
    field(9, new Uint8Array(16)),
  );
  const tensorType = message(
    integer(1, 1),
    field(
      2,
      message(
        field(1, message(integer(1, 1))),
        field(1, message(integer(1, 4))),
      ),
    ),
  );
  const input = message(
    text(1, "input"),
    field(2, message(field(1, tensorType))),
  );
  const output = message(
    text(1, "output"),
    field(2, message(field(1, tensorType))),
  );
  const node = message(
    text(1, "input"),
    text(1, "weights"),
    text(2, "output"),
    text(4, "Add"),
  );
  const graph = message(
    field(1, node),
    text(2, "main"),
    field(5, initializer),
    field(11, input),
    field(12, output),
  );
  const opset = message(integer(2, 13));
  return message(field(7, graph), field(8, opset));
}

Deno.test("direct ONNX inspection extracts graph metadata and lazy initializer range", async () => {
  const bytes = tinyOnnx();
  const inspection = inspectOnnx(bytes, {
    source: {
      id: "memory:tiny.onnx",
      format: "onnx",
      kind: "memory",
      version: "fixture-v1",
    },
  });
  assertEquals(validateModelDocument(inspection.document), []);
  const graph = inspection.document.graphs[0];
  assertEquals(graph.metadata?.operatorGraphAvailable, true);
  assertEquals(
    graph.nodes.filter((node) => node.kind === "operator")[0].op,
    "Add",
  );
  assertEquals(graph.edges.length, 3);
  assertEquals(
    graph.nodes.filter((node) => node.kind === "operator")[0].provenance?.[0]
      .byteLength !== undefined,
    true,
  );
  const input = Object.values(inspection.document.tensors).find((tensor) =>
    tensor.name === "input"
  )!;
  assertEquals(input.dtype, "f32");
  assertEquals(input.shape, [1, 4]);
  const weights = Object.values(inspection.document.tensors).find((tensor) =>
    tensor.name === "weights"
  )!;
  assertEquals(weights.shape, [2, 2]);
  assertEquals(weights.payload?.byteLength, 16);
  assertEquals(weights.provenance?.[0].byteOffset, weights.payload?.byteOffset);
  const selected = await inspection.source.readRange({
    sourceId: "memory:tiny.onnx",
    byteOffset: weights.payload!.byteOffset,
    byteLength: 4,
    dtype: "f32",
    shape: [1],
  });
  assertEquals(new Uint8Array(selected), new Uint8Array(4));
});

Deno.test("direct ONNX inspection bounds malformed and oversized inputs", () => {
  assertThrows(
    () =>
      inspectOnnx(new Uint8Array([0x3a, 0x04, 0x0a]), {
        source: { id: "bad", format: "onnx", kind: "memory" },
      }),
    OnnxFormatError,
  );
  assertThrows(
    () =>
      inspectOnnx(tinyOnnx(), {
        source: { id: "large", format: "onnx", kind: "memory" },
        maxModelBytes: 1,
      }),
    OnnxFormatError,
  );
});
