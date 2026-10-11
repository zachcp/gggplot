import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { ingest, typedArrayForColumn } from "../src/data/mod.ts";
import { type ColumnMount, planColumnMounts } from "../src/runtime/live.tsx";
import {
  createResidentColumn,
  destroyResidentColumns,
  residentColumnFromColumn,
} from "../src/runtime/column_loader.ts";
import {
  type GPUStorageSource,
  isResidentColumn,
  type MountedDataFrame,
} from "../src/runtime/types.ts";
import type { FieldSpec } from "../src/plan/mod.ts";

// The column half of the loader tier (gggplot-vs7.10). Two claims are under
// test: a resident column mounts with NO upload at all, and every requested
// field occupies exactly one mount slot whether or not its column is present.
//
// planColumnMounts is the pure decision GPUDataProvider makes before its one
// flat raw-source hook per field (gggplot-vnh.17), so it is tested directly --
// no device and no mounted tree needed.

const requireWebGpu = Deno.env.get("GGGPLOT_REQUIRE_WEBGPU") === "1";

async function requestTestDevice(): Promise<GPUDevice | null> {
  const gpu = globalThis.navigator?.gpu;
  if (!gpu) {
    assert(!requireWebGpu, "navigator.gpu is required");
    return null;
  }
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    assert(!requireWebGpu, "WebGPU adapter is required");
    return null;
  }
  return await adapter.requestDevice();
}

interface Walk {
  /** One entry per mount slot, in order. */
  levels: ColumnMount["kind"][];
  /** Typed arrays that would be uploaded, by field name. */
  uploads: Record<string, Float32Array | Uint32Array>;
  /** The sources that reach the consumer for resident fields. */
  sources: Record<string, GPUStorageSource>;
}

function walk(data: MountedDataFrame, fields: FieldSpec[]): Walk {
  const result: Walk = { levels: [], uploads: {}, sources: {} };
  for (const mount of planColumnMounts(data, fields)) {
    result.levels.push(mount.kind);
    if (mount.kind === "upload") result.uploads[mount.name] = mount.array;
    if (mount.kind === "resident") result.sources[mount.name] = mount.source;
  }
  return result;
}

const FIELDS: FieldSpec[] = [
  { name: "x", dtype: "f32" } as FieldSpec,
  { name: "g", dtype: "u32" } as FieldSpec,
  { name: "y", dtype: "f32" } as FieldSpec,
];

Deno.test("the mount chain is one level per requested field, present or not", () => {
  const full = ingest({
    x: [1, 2, 3],
    g: ["a", "b", "a"],
    y: [4, 5, 6],
  }, { columns: { g: { type: "factor" } } });

  const all = walk(full, FIELDS);
  assertEquals(all.levels, ["upload", "upload", "upload"]);

  // Drop the middle column. Before gggplot-vs7.10 this collapsed the mount
  // to two slots, which moved `y` UP a slot and remounted it -- a re-upload
  // caused purely by an unrelated field going missing.
  const partial = { ...full };
  delete (partial as Record<string, unknown>).g;
  const some = walk(partial, FIELDS);
  assertEquals(some.levels, ["upload", "absent", "upload"]);
  assertEquals(Object.keys(some.uploads).sort(), ["x", "y"]);

  // The slot count is a function of fields.length alone, which is the property
  // that keeps each field's hook slot stable.
  assertEquals(all.levels.length, FIELDS.length);
  assertEquals(some.levels.length, FIELDS.length);
});

Deno.test("a resident column mounts with no upload node at all", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  const resident = createResidentColumn(device, new Float32Array([1, 2, 3]));
  const frame: MountedDataFrame = {
    x: resident,
    ...ingest({ y: [4, 5, 6] }),
  };
  const fields: FieldSpec[] = [
    { name: "x", dtype: "f32" } as FieldSpec,
    { name: "y", dtype: "f32" } as FieldSpec,
  ];

  const walked = walk(frame, fields);
  // The resident field holds its slot without an upload -- that absence IS the
  // zero-upload claim, since the raw-source hook is the only thing here that
  // allocates or writes.
  assertEquals(walked.levels, ["resident", "upload"]);
  assertEquals(Object.keys(walked.uploads), ["y"]);
  // And the source that reaches the consumer is the caller's own buffer, by
  // identity -- not a copy of it.
  assertEquals(walked.sources.x, resident.source);
  assertEquals(walked.sources.x.buffer, resident.source.buffer);

  destroyResidentColumns([resident]);
  device.destroy();
});

Deno.test("the plain Column path is byte-identical to what it uploaded before", () => {
  const frame = ingest({ x: [1, 2, null], g: ["a", "b", "a"] }, {
    columns: { g: { type: "factor" } },
  });
  const fields: FieldSpec[] = [
    { name: "x", dtype: "f32" } as FieldSpec,
    { name: "g", dtype: "u32" } as FieldSpec,
  ];
  const walked = walk(frame, fields);

  // Same arrays, and the SAME array objects -- identity is the zero-re-upload
  // signal the pack cache depends on.
  assertEquals(walked.uploads.x, typedArrayForColumn(frame.x));
  assert(walked.uploads.x === typedArrayForColumn(frame.x));
  assertEquals(Array.from(walked.uploads.x), [1, 2, NaN]);
  assertEquals(Array.from(walked.uploads.g), [0, 1, 0]);
});

Deno.test("a resident column is uploaded once and carries its own format", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  const numeric = createResidentColumn(device, new Float32Array([1.5, 2.5]));
  assertEquals(numeric.type, "numeric");
  assertEquals(numeric.source.format, "f32");
  assertEquals(numeric.source.length, 2);
  assert(isResidentColumn(numeric));

  const factor = createResidentColumn(device, new Uint32Array([0, 1, 0]), {
    levels: ["a", "b"],
  });
  assertEquals(factor.type, "factor");
  assertEquals(factor.source.format, "u32");
  assertEquals(factor.levels, ["a", "b"]);

  destroyResidentColumns([numeric, factor]);
  device.destroy();
});

Deno.test("a factor without its dictionary is refused rather than mounted blind", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  // Level codes with no dictionary would render as bare integers and produce a
  // legend with no labels, which is a silent wrong answer rather than an error.
  assertThrows(
    () => createResidentColumn(device, new Uint32Array([0, 1])),
    Error,
    "requires `levels`",
  );
  assertThrows(
    () =>
      createResidentColumn(device, new Float32Array([1]), { levels: ["a"] }),
    Error,
    "must not carry `levels`",
  );
  device.destroy();
});

Deno.test("a resident column whose type contradicts the field fails at mount", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  const factor = createResidentColumn(device, new Uint32Array([0, 1]), {
    levels: ["a", "b"],
  });
  assertThrows(
    () => walk({ x: factor }, [{ name: "x", dtype: "f32" } as FieldSpec]),
    Error,
    "does not match factor column",
  );
  destroyResidentColumns([factor]);
  device.destroy();
});

Deno.test("residentColumnFromColumn reuses the identity-cached lowering", async () => {
  const device = await requestTestDevice();
  if (!device) return;

  const frame = ingest({ x: [1, 2, 3], g: ["a", "b", "a"] }, {
    columns: { g: { type: "factor" } },
  });
  const numeric = residentColumnFromColumn(device, frame.x);
  const factor = residentColumnFromColumn(device, frame.g);

  assertEquals(numeric.source.length, 3);
  assertEquals(factor.source.format, "u32");
  // The factor's dictionary comes across without being asked for: a caller
  // converting a Column should not have to restate what the Column already says.
  assertEquals(factor.levels, ["a", "b"]);
  assertExists(numeric.source.buffer);

  destroyResidentColumns([numeric, factor]);
  device.destroy();
});
