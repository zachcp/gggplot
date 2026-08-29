import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { inspectOnnx } from "@gggplot/model-inspect";
import {
  DEFAULT_MODEL_FIXTURE,
  fixtureById,
  MODEL_FIXTURES,
} from "../model_fixtures.ts";

Deno.test("bundled ONNX smoke model is present and attributed", async () => {
  const modelUrl = new URL(
    "../../public/models/mnist-12.onnx",
    import.meta.url,
  );
  const readmeUrl = new URL("../../public/models/README.md", import.meta.url);
  const model = await Deno.readFile(modelUrl);
  const readme = await Deno.readTextFile(readmeUrl);

  assert(model.byteLength > 20_000);
  assertStringIncludes(readme, "Apache-2.0");
  assertStringIncludes(readme, "mnist-12.onnx");
  assertStringIncludes(
    readme,
    "5c688690f8bacf667d4c2074af5ad0646ca328d7ab03eccf944a65b320171bdd",
  );
});

Deno.test("curated ONNX fixtures are selectable, local, and topologically distinct", async () => {
  assertEquals(fixtureById("not-a-fixture"), DEFAULT_MODEL_FIXTURE);
  assertEquals(
    new Set(MODEL_FIXTURES.map((fixture) => fixture.id)).size,
    MODEL_FIXTURES.length,
  );
  assertEquals(
    new Set(MODEL_FIXTURES.map((fixture) => fixture.path)).size,
    MODEL_FIXTURES.length,
  );

  const nodeCounts: number[] = [];
  const topologySizes = new Map<string, { nodes: number; edges: number }>();
  for (const fixture of MODEL_FIXTURES) {
    const modelUrl = new URL("../../public" + fixture.path, import.meta.url);
    const model = await Deno.readFile(modelUrl);
    const { document } = inspectOnnx(model, {
      source: {
        id: "fixture:" + fixture.id,
        format: "onnx",
        kind: "memory",
        uri: fixture.path,
        byteLength: model.byteLength,
      },
    });
    assert(
      document.graphs[0].nodes.length > 3,
      `${fixture.id} should have a graph`,
    );
    assert(
      document.graphs[0].edges.length > 2,
      `${fixture.id} should have edges`,
    );
    nodeCounts.push(document.graphs[0].nodes.length);
    topologySizes.set(fixture.id, {
      nodes: document.graphs[0].nodes.length,
      edges: document.graphs[0].edges.length,
    });
  }
  assert(
    new Set(nodeCounts).size >= 3,
    "fixture graphs should exercise distinct layouts",
  );
  const multiHead = topologySizes.get("multi-head")!;
  const encoderStack = topologySizes.get("tiny-encoder-stack")!;
  assert(encoderStack.nodes > multiHead.nodes * 2);
  assert(encoderStack.edges > multiHead.edges * 2);
});
