import { assertEquals } from "jsr:@std/assert@1";
import { assetUrl } from "./asset_url.ts";

// Under Deno there is no import.meta.env, so assetUrl falls back to "/" —
// the same base a root-served dev build uses. These pin the join itself.

Deno.test("assetUrl keeps root-relative paths intact at the default base", () => {
  assertEquals(
    assetUrl("/fonts/Basic-Regular.ttf"),
    "/fonts/Basic-Regular.ttf",
  );
  assertEquals(assetUrl("/data/mpg.csv"), "/data/mpg.csv");
});

Deno.test("assetUrl tolerates a missing leading slash", () => {
  assertEquals(assetUrl("models/mnist-12.onnx"), "/models/mnist-12.onnx");
});

Deno.test("assetUrl never doubles a slash at the join", () => {
  assertEquals(assetUrl("//data/mpg.csv"), "/data/mpg.csv");
});

Deno.test("assetUrl passes absolute URLs through untouched", () => {
  const remote = "https://example.com/data/mpg.csv";
  assertEquals(assetUrl(remote), remote);
});

// Declared asset paths must stay root-relative: the Deno asset tests join them
// onto public/ directly, and assetUrl is what adapts them to a subpath deploy.
Deno.test("declared fixture and dataset paths are root-relative", async () => {
  const { MODEL_FIXTURES } = await import("./model_fixtures.ts");
  const { staticDatasets } = await import("./docs/data/real.ts");
  for (const fixture of MODEL_FIXTURES) {
    assertEquals(fixture.path.startsWith("/"), true, fixture.path);
  }
  for (const dataset of Object.values(staticDatasets)) {
    assertEquals(dataset.url.startsWith("/"), true, dataset.url);
  }
});
