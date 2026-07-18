import { assertEquals, assertThrows } from "@std/assert";
import {
  createFontResources,
  createGlyphTextMeasurer,
  validateFontRequests,
} from "../src/render/font_resources.ts";
import { geomText, ggplot, theme } from "../src/dsl/mod.ts";

const faces = [
  { family: "Basic", weight: 400, style: "normal" as const, src: "basic.ttf" },
  { family: "Basic", weight: 700, style: "italic" as const, src: "bold.ttf" },
  { family: "Lato", weight: 400, style: "normal" as const, src: "lato.ttf" },
];

Deno.test("font resources expose a deterministic default and readiness gate", async () => {
  const resources = createFontResources(faces);
  assertEquals(resources.defaultFace, faces[0]);
  assertEquals(await resources.ready(), undefined);
  assertEquals(await resources.readyForExport(), undefined);
});

Deno.test("glyph text measurement uses resolved RustText spans and height", () => {
  const calls: unknown[] = [];
  const rustText = {
    resolveFontStack: (requested: unknown) => {
      calls.push(requested);
      return [7];
    },
    measureSpans: (_stack: number[], text: Uint16Array, size: number) => {
      calls.push([Array.from(text), size]);
      return {
        metrics: new Float32Array([42, 0, 0]),
        breaks: new Uint32Array(),
        glyphs: new Int32Array(),
        missing: new Int32Array(),
      };
    },
    measureFont: () => ({
      ascent: 9,
      descent: -3,
      lineHeight: 14,
      xHeight: 7,
      emUnit: 10,
    }),
  };
  const measure = createGlyphTextMeasurer(rustText as never);
  assertEquals(measure("Hi", 12, "Basic", "bold", "italic"), {
    width: 42,
    height: 14,
  });
  assertEquals(calls[0], [{ family: "Basic", weight: 700, style: "italic" }]);
});

Deno.test("explicit missing font requests fail with the resolved face", () => {
  const resources = createFontResources(faces);
  const spec = ggplot({ x: [0], y: [0], label: ["x"] }, {
    x: "x",
    y: "y",
    label: "label",
  }).add(
    geomText(),
    theme({ fontFamily: "Missing", fontWeight: "bold" }),
  ).build();
  assertThrows(
    () => validateFontRequests(spec, resources),
    Error,
    'family="Missing", weight=700, style="normal"',
  );
});

Deno.test("mapped family/fontface requests validate every semantic batch", () => {
  const resources = createFontResources(faces);
  const valid = ggplot(
    {
      x: [0, 1],
      y: [0, 1],
      label: ["a", "b"],
      family: ["Basic", "Lato"],
      face: ["bold.italic", "plain"],
    },
    {
      x: "x",
      y: "y",
      label: "label",
      family: "family",
      fontface: "face",
    },
  ).add(geomText()).build();
  validateFontRequests(valid, resources);

  const invalid = ggplot(
    {
      x: [0],
      y: [0],
      label: ["a"],
      family: ["Lato"],
      face: ["italic"],
    },
    {
      x: "x",
      y: "y",
      label: "label",
      family: "family",
      fontface: "face",
    },
  ).add(geomText()).build();
  assertThrows(
    () => validateFontRequests(invalid, resources),
    Error,
    'family="Lato", weight=400, style="italic"',
  );
});
