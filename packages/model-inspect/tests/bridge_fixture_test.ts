import { assert, assertEquals } from "@std/assert";
import { inspectSafeTensors } from "../src/safetensors.ts";
import { validateModelDocument } from "../src/validate.ts";
import { buildTensorContentProduct } from "../src/products.ts";
import { ByteArrayTensorSource } from "../src/residency.ts";
import type { ModelDocument } from "../src/types.ts";

/**
 * Cross-language round trip for the PyTorch bridge.
 *
 * The fixture is produced by tools/pytorch_bridge (`--demo`), which writes
 * SafeTensors and a model document from Python. These tests read both back
 * through the TypeScript package, so a change to either side that breaks the
 * contract between them fails here rather than in a browser.
 */

const fixture = (name: string) =>
  new URL(`./fixtures/${name}`, import.meta.url);

const weights = async () =>
  new Uint8Array(await Deno.readFile(fixture("tiny-mlp.safetensors")));

const emittedDocument = async (): Promise<ModelDocument> =>
  JSON.parse(await Deno.readTextFile(fixture("tiny-mlp.model.json")));

Deno.test("the bridge's SafeTensors output parses in TypeScript", async () => {
  const inspection = inspectSafeTensors(await weights(), {
    source: {
      id: "file:tiny-mlp.safetensors",
      format: "safetensors",
      kind: "file",
      uri: "tiny-mlp.safetensors",
    },
  });
  const names = Object.values(inspection.document.tensors)
    .map((tensor) => tensor.name)
    .sort();
  assertEquals(names, [
    "layers.0.bias",
    "layers.0.weight",
    "layers.2.bias",
    "layers.2.weight",
  ]);
});

Deno.test("the bridge's emitted document is valid on its own", async () => {
  assertEquals(validateModelDocument(await emittedDocument()), []);
});

Deno.test("Python and TypeScript agree on shapes, dtypes, and byte ranges", async () => {
  const parsed = inspectSafeTensors(await weights(), {
    source: {
      id: "file:tiny-mlp.safetensors",
      format: "safetensors",
      kind: "file",
      uri: "tiny-mlp.safetensors",
    },
  }).document;
  const emitted = await emittedDocument();

  const byName = (document: ModelDocument) =>
    new Map(
      Object.values(document.tensors).map((tensor) => [tensor.name!, tensor]),
    );
  const fromParse = byName(parsed);
  const fromPython = byName(emitted);
  assertEquals(fromParse.size, fromPython.size);

  for (const [name, pythonTensor] of fromPython) {
    const parsedTensor = fromParse.get(name);
    assert(parsedTensor, `TypeScript did not parse ${name}`);
    assertEquals(parsedTensor.dtype, pythonTensor.dtype, name);
    assertEquals(parsedTensor.shape, pythonTensor.shape, name);
    assertEquals(parsedTensor.byteLength, pythonTensor.byteLength, name);
    // ModelDocument payload offsets address the whole source file.
    assertEquals(
      parsedTensor.payload,
      pythonTensor.payload,
      name,
    );
  }
});

Deno.test("bridge document reads back the values Python wrote", async () => {
  const bytes = await weights();
  const document = await emittedDocument();
  const bias = Object.values(document.tensors)
    .find((tensor) => tensor.name === "layers.2.bias")!;
  const product = await buildTensorContentProduct(
    document,
    new ByteArrayTensorSource(document.source.id, "v1", bytes),
    { target: { kind: "tensor", tensorId: bias.id }, axes: [0] },
  );
  // demo_tensors() ramps this bias by 0.5 per element.
  assertEquals(product.values, [0.5, 1]);
});

Deno.test("a weights-only export declares that it has no graph", async () => {
  const emitted = await emittedDocument();
  assertEquals(emitted.graphs[0].nodes.length, 0);
  assertEquals(emitted.graphs[0].edges.length, 0);
  // The absence has to be stated, or a consumer cannot tell "no topology" from
  // "topology we failed to read".
  assertEquals(emitted.metadata?.graphStructure, "none");
  assert(String(emitted.metadata?.graphStructureReason).includes("ONNX"));
});
