import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { ingest, typedArrayForColumn } from "../src/data/mod.ts";
import { GPUDataProvider } from "../src/runtime/live.tsx";
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
import { RawData } from "../src/runtime/usegpu_compat.ts";
import type { FieldSpec } from "../src/plan/mod.ts";

// The column half of the loader tier (gggplot-vs7.10). Two claims are under
// test: a resident column mounts with NO upload node at all, and the mount
// chain's DEPTH no longer depends on which columns happen to be present.
//
// GPUDataProvider is a plain function returning a Live element tree, so the
// chain can be walked directly -- no device and no mounted tree needed. The one
// node we must not actually invoke is RawData itself (it allocates); at that
// level the walker calls its `children` with a stand-in source, which is exactly
// what RawData does once it has uploaded.

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
  /** One entry per mounted level, in order. */
  levels: ("RawData" | "hold")[];
  /** Typed arrays RawData was asked to upload, by field name. */
  uploads: Record<string, Float32Array | Uint32Array>;
  sources: Record<string, GPUStorageSource>;
}

// deno-lint-ignore no-explicit-any
const any = (value: unknown): any => value;

function stubSource(name: string, length: number): GPUStorageSource {
  return {
    buffer: { __stub: name } as unknown as GPUBuffer,
    format: "f32",
    length,
    size: [length],
    version: 1,
  };
}

function walk(
  data: MountedDataFrame,
  fields: FieldSpec[],
): Walk {
  const result: Walk = { levels: [], uploads: {}, sources: {} };
  let element = any(GPUDataProvider)({
    data,
    fields,
    children: (sources: Record<string, GPUStorageSource>) => {
      result.sources = sources;
      return null;
    },
  });
  let guard = 0;
  while (element && any(element).f && guard++ < 64) {
    const node = any(element);
    const props = node.args[0];
    if (node.f === RawData) {
      result.levels.push("RawData");
      // Whichever field this level is for is the one not yet in `uploads`.
      const field = fields.find((f) =>
        !(f.name in result.uploads) && data[f.name] &&
        !isResidentColumn(data[f.name])
      )!;
      result.uploads[field.name] = props.data;
      element = props.children(stubSource(field.name, props.data.length));
    } else {
      result.levels.push("hold");
      element = node.f(props);
    }
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
  assertEquals(all.levels, ["RawData", "RawData", "RawData"]);

  // Drop the middle column. Before gggplot-vs7.10 this collapsed the chain to
  // two levels, which moved `y`'s RawData UP a level and remounted it -- a
  // re-upload caused purely by an unrelated field going missing.
  const partial = { ...full };
  delete (partial as Record<string, unknown>).g;
  const some = walk(partial, FIELDS);
  assertEquals(some.levels, ["RawData", "hold", "RawData"]);
  assertEquals(Object.keys(some.sources).sort(), ["x", "y"]);

  // The depth is a function of fields.length alone, which is the property that
  // makes a level's position stable.
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
  // The resident field's level holds depth without mounting RawData -- that
  // absence IS the zero-upload claim, since RawData is the only thing in this
  // chain that allocates or writes.
  assertEquals(walked.levels, ["hold", "RawData"]);
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
