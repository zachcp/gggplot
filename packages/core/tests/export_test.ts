import { assertEquals, assertThrows } from "@std/assert";
import {
  pngDimensions,
  resolveExportSize,
  validateExportDimensions,
} from "../src/export/utils.ts";

Deno.test("PNG export dimensions require exact positive integer pixels", () => {
  validateExportDimensions(320, 200, 4096);
  assertThrows(
    () => validateExportDimensions(0, 200),
    RangeError,
    "positive integer pixels",
  );
  assertThrows(
    () => validateExportDimensions(320.5, 200),
    RangeError,
    "positive integer pixels",
  );
  assertThrows(
    () => validateExportDimensions(5000, 200, 4096),
    RangeError,
    "maxTextureDimension2D=4096",
  );
});

Deno.test("physical units, DPI, scale, and rounding resolve deterministically", () => {
  assertEquals(resolveExportSize({ width: 320, height: 200 }), {
    width: 320,
    height: 200,
    pixelRatio: 1,
    layoutWidth: 320,
    layoutHeight: 200,
  });
  assertEquals(
    resolveExportSize({
      width: 2,
      height: 1,
      units: "in",
      dpi: 300,
      scale: 2,
    }),
    {
      width: 1200,
      height: 600,
      pixelRatio: 2,
      layoutWidth: 600,
      layoutHeight: 300,
    },
  );
  assertEquals(
    resolveExportSize({
      width: 2.54,
      height: 2.54,
      units: "cm",
      dpi: 300,
    }).width,
    300,
  );
  assertEquals(
    resolveExportSize({
      width: 25.4,
      height: 25.4,
      units: "mm",
      dpi: 300,
    }).width,
    300,
  );
  assertEquals(
    resolveExportSize({ width: 1, height: 1, units: "in", dpi: 2.5 }).width,
    3,
  );
  assertEquals(
    resolveExportSize({
      width: 10,
      height: 5,
      units: "px",
      dpi: 72,
      scale: 1.5,
    }),
    {
      width: 15,
      height: 8,
      pixelRatio: 1.5,
      layoutWidth: 10,
      layoutHeight: 16 / 3,
    },
  );
  assertThrows(
    () => resolveExportSize({ width: 1, height: 1, dpi: 0 }),
    RangeError,
    "DPI",
  );
  assertThrows(
    () => resolveExportSize({ width: 1, height: 1, scale: 0 }),
    RangeError,
    "scale",
  );
});

Deno.test("PNG IHDR dimensions are decoded and invalid data is rejected", () => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 640);
  view.setUint32(20, 360);
  assertEquals(pngDimensions(bytes), [640, 360]);
  assertThrows(
    () => pngDimensions(new Uint8Array(24)),
    Error,
    "invalid PNG",
  );
});
