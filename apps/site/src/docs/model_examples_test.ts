import { assertEquals } from "@std/assert";
import { validateModelDocument } from "@gggplot/model-inspect";
import { tinyMlpInspection } from "./model_examples.ts";

Deno.test("model inspection docs example is a valid portable document", () => {
  assertEquals(validateModelDocument(tinyMlpInspection.document), []);
  const pagesSource = Deno.readTextFileSync(
    new URL("./pages.ts", import.meta.url),
  );
  assertEquals(pagesSource.includes('slug: "model-inspection"'), true);
  assertEquals(
    pagesSource.includes("modelExamples: [tinyMlpInspection]"),
    true,
  );
  assertEquals(tinyMlpInspection.document.graphs[0].nodes.length, 3);
  assertEquals(Object.keys(tinyMlpInspection.document.tensors).length, 7);
});
