import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  inspectSafeTensors,
  SafeTensorsFormatError,
  type TensorRangeRequest,
} from "../src/mod.ts";

const encoder = new TextEncoder();

function fixture(): Uint8Array {
  const header = encoder.encode(JSON.stringify({
    "encoder.weight": { dtype: "F32", shape: [2, 2], data_offsets: [0, 16] },
    __metadata__: { format: "pt" },
  }));
  const bytes = new Uint8Array(8 + header.length + 16);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(header.length), true);
  bytes.set(header, 8);
  bytes.set(new Uint8Array([1, 2, 3, 4]), 8 + header.length + 4);
  return bytes;
}

Deno.test("SafeTensors inspection retains lazy, bounded payload ranges", async () => {
  const bytes = fixture();
  const inspection = inspectSafeTensors(bytes, {
    source: {
      id: "memory:weights",
      format: "safetensors",
      kind: "memory",
      version: "v1",
    },
  });
  const tensor = Object.values(inspection.document.tensors)[0];
  assertEquals(tensor.dtype, "f32");
  assertEquals(tensor.shape, [2, 2]);
  assertEquals(tensor.payload?.byteLength, 16);
  const request: TensorRangeRequest = {
    sourceId: "memory:weights",
    byteOffset: tensor.payload!.byteOffset + 4,
    byteLength: 4,
    dtype: "f32",
    shape: [1],
  };
  assertEquals(
    new Uint8Array(await inspection.source.readRange(request)),
    new Uint8Array([1, 2, 3, 4]),
  );
  await assertRejects(
    () =>
      inspection.source.readRange({ ...request, byteLength: bytes.byteLength }),
    RangeError,
  );
});

Deno.test("SafeTensors rejects malformed and truncated untrusted headers", () => {
  assertThrows(
    () =>
      inspectSafeTensors(new Uint8Array(7), {
        source: { id: "bad", format: "safetensors", kind: "memory" },
      }),
    SafeTensorsFormatError,
  );
  const truncated = new Uint8Array(8);
  new DataView(truncated.buffer).setBigUint64(0, 12n, true);
  assertThrows(
    () =>
      inspectSafeTensors(truncated, {
        source: { id: "bad", format: "safetensors", kind: "memory" },
      }),
    SafeTensorsFormatError,
  );
  const invalidOffsets = fixture();
  assertThrows(
    () =>
      inspectSafeTensors(invalidOffsets, {
        source: { id: "bad", format: "safetensors", kind: "memory" },
        maxHeaderBytes: 8,
      }),
    SafeTensorsFormatError,
  );
  const header = encoder.encode(JSON.stringify({
    first: { dtype: "F32", shape: [1], data_offsets: [0, 4] },
    second: { dtype: "F32", shape: [1], data_offsets: [2, 6] },
  }));
  const overlapping = new Uint8Array(8 + header.length + 6);
  new DataView(overlapping.buffer).setBigUint64(0, BigInt(header.length), true);
  overlapping.set(header, 8);
  assertThrows(
    () =>
      inspectSafeTensors(overlapping, {
        source: { id: "bad", format: "safetensors", kind: "memory" },
      }),
    SafeTensorsFormatError,
  );
});
