import { assert, assertEquals } from "@std/assert";
import { inspectSafeTensors } from "../src/safetensors.ts";
import { buildTensorContentProduct } from "../src/products.ts";
import { ByteArrayTensorSource } from "../src/residency.ts";
import { validateModelDocument } from "../src/validate.ts";

/**
 * Round trip against a REAL PyTorch artifact (gggplot-i5m.25).
 *
 * bridge_fixture_test.ts covers the `--demo` path, which synthesizes tensors
 * in Python and never touches torch. That left the bridge's torch-reading half
 * -- `tensors_from_state_dict` and the `torch.load` in `cli._load_state_dict`
 * -- completely unexecuted, because torch is not in this toolchain.
 *
 * These fixtures were produced once, on a machine with torch 2.13.0, by saving
 * an nn.Module state_dict and running the CLI over it for real. `truth.json`
 * records what torch itself reported for every tensor, so CI re-verifies the
 * agreement without needing torch installed.
 *
 * The fixture is deliberately awkward:
 *   - every dtype the bridge maps: f32, f64, i8, i16, i32, i64, u8
 *   - `probe.transposed` is a NON-CONTIGUOUS view (`base.t()`). Ground truth is
 *     recorded post-`.contiguous()`, so if the bridge ever dropped that call
 *     the values would still be the right count and shape but in pre-transpose
 *     order, and only a value comparison catches it.
 */

const fixture = (name: string) =>
  new URL(`./fixtures/${name}`, import.meta.url);

const bytes = new Uint8Array(
  await Deno.readFile(fixture("torch-real.safetensors")),
);
const truth: Record<
  string,
  { dtype: string; shape: number[]; values: number[] }
> = JSON.parse(await Deno.readTextFile(fixture("torch-real.truth.json")));

const source = {
  id: "file:tinynet.safetensors",
  format: "safetensors" as const,
  kind: "file" as const,
  uri: "tinynet.safetensors",
};

const parsed = () => inspectSafeTensors(bytes, { source }).document;

/** torch dtype spelling -> the ModelDType the reader must report. */
const AS_MODEL_DTYPE: Record<string, string> = {
  float32: "f32",
  float64: "f64",
  int8: "i8",
  int16: "i16",
  int32: "i32",
  int64: "i64",
  uint8: "u8",
};

Deno.test("a real torch state_dict parses into a valid document", () => {
  assertEquals(validateModelDocument(parsed()), []);
  assertEquals(Object.keys(parsed().tensors).length, Object.keys(truth).length);
});

Deno.test("torch and TypeScript agree on dtype and shape for every tensor", () => {
  const byName = new Map(
    Object.values(parsed().tensors).map((t) => [t.name ?? t.id, t]),
  );
  for (const [name, want] of Object.entries(truth)) {
    const got = byName.get(name);
    assert(got, `${name} missing from the parsed document`);
    assertEquals(got.dtype, AS_MODEL_DTYPE[want.dtype], `${name} dtype`);
    assertEquals(got.shape, want.shape, `${name} shape`);
  }
});

Deno.test("torch and TypeScript agree on every decoded value", async () => {
  const document = parsed();
  // Payload offsets are absolute within the file, under the source id given to
  // inspectSafeTensors, so the reader is backed by the whole file.
  const reader = new ByteArrayTensorSource(source.id, "unknown", bytes);
  const byName = new Map(
    Object.values(document.tensors).map((t) => [t.name ?? t.id, t]),
  );
  for (const [name, want] of Object.entries(truth)) {
    const descriptor = byName.get(name)!;
    const product = await buildTensorContentProduct(document, reader, {
      target: { kind: "tensor", tensorId: descriptor.id },
    });
    assertEquals(product.representation, "exact", `${name} representation`);
    const values = (product.values ?? []).map(Number);
    assertEquals(values.length, want.values.length, `${name} value count`);
    for (const [index, value] of values.entries()) {
      assert(
        Math.abs(value - want.values[index]) <= 1e-6,
        `${name}[${index}]: ${value} != torch ${want.values[index]}`,
      );
    }
  }
});

Deno.test("64-bit integer tensors decode instead of degrading to metadata", async () => {
  // Regression for the gap this bead found: numericWidth omitted i64/u64, so
  // chooseRepresentation returned "metadata" and every 64-bit integer tensor
  // came back with no values at all -- silently, and for the dtype ONNX uses
  // for shapes, indices, and token ids.
  const document = parsed();
  const reader = new ByteArrayTensorSource(source.id, "unknown", bytes);
  const i64 = Object.values(document.tensors).find((t) => t.dtype === "i64");
  assert(i64, "fixture must carry an i64 tensor");
  const product = await buildTensorContentProduct(document, reader, {
    target: { kind: "tensor", tensorId: i64.id },
  });
  assertEquals(product.representation, "exact");
  assertEquals(product.values?.map(Number), truth["probe.i64"].values);
});
