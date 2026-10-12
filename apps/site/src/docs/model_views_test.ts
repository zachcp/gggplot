import { assert, assertEquals } from "@std/assert";
import { printJsx } from "@gggplot/core";
import {
  buildTensorContentProduct,
  ByteArrayTensorSource,
  inspectOnnx,
} from "@gggplot/model-inspect";
import {
  hasMatrixCells,
  tensorInventory,
  tensorInventoryChart,
  tensorMatrixChart,
  trailingMatrixRequest,
} from "../model_tensor_views.tsx";

import { SitePlot } from "../site_plot.tsx";

/** A chart printed as JSX, its data rows passed by reference as `rows`. */
function printed(chart: Parameters<typeof printJsx>[0]) {
  const props = (chart as unknown as { args: [{ data: unknown[] }] }).args[0];
  return {
    source: printJsx(chart, {
      refs: new Map([[props.data, "rows"]]),
      names: new Map([[SitePlot, "GGPlot"]]),
    }).source,
    rows: props.data,
  };
}

const modelBytes = async () =>
  new Uint8Array(
    await Deno.readFile(
      new URL("../../public/models/mnist-12.onnx", import.meta.url),
    ),
  );

const inspected = async () => {
  const bytes = await modelBytes();
  const source = {
    id: "test:mnist",
    format: "onnx",
    kind: "memory" as const,
    byteLength: bytes.byteLength,
  };
  return {
    inspection: inspectOnnx(bytes, { source }),
    tensorSource: new ByteArrayTensorSource("test:mnist", "v1", bytes),
  };
};

Deno.test("parameter inventory ranks tensors by stored bytes", async () => {
  const { inspection } = await inspected();
  const entries = tensorInventory(inspection.document);
  assert(entries.length > 0, "mnist-12 should expose parameter tensors");
  // Descending by size, which is the whole point of the view.
  for (let i = 1; i < entries.length; i++) {
    assert(
      entries[i - 1].byteLength >= entries[i].byteLength,
      "inventory must be ordered by descending byte length",
    );
  }
  assertEquals(entries.length, Math.min(entries.length, 12));
});

Deno.test("inventory chart draws a bar per tensor", async () => {
  const { inspection } = await inspected();
  const chart = tensorInventoryChart(inspection.document, 5);
  assert(chart, "inventory chart should exist for a model with parameters");
  const { source, rows } = printed(chart);
  assertEquals(
    source,
    `<GGPlot data={rows} mapping={{ x: "tensor", y: "kilobytes" }}>
  <GeomCol fill="#60a5fa" />
  <Labs title="Parameter bytes by tensor" x="tensor" y="KiB" />
  <ThemeMinimal />
</GGPlot>`,
  );
  assertEquals(rows.length, tensorInventory(inspection.document, 5).length);
});

Deno.test("matrix view lowers a bounded tensor product to a heatmap", async () => {
  const { inspection, tensorSource } = await inspected();
  const entries = tensorInventory(inspection.document);
  const descriptor = inspection.document.tensors[entries[0].tensorId];
  const product = await buildTensorContentProduct(
    inspection.document,
    tensorSource,
    trailingMatrixRequest(entries[0].tensorId, descriptor.shape),
  );
  // The largest mnist-12 weight must reach a real grid, not fall back to
  // metadata. Asserting the representation keeps this test from passing
  // vacuously the way an early return would.
  assertEquals(product.representation, "downsample");
  assertEquals(hasMatrixCells(product), true);
  const chart = tensorMatrixChart(product);
  assert(chart, "a product with cells must produce a chart");
  const { source, rows: cells } = printed(chart);
  assert(source.includes("<GeomRaster />"), source);
  assert(source.includes('mapping={{ x: "column", y: "row", fill: "value" }}'));
  const [rows, columns] = product.gridShape!;
  assertEquals(product.values!.length, rows * columns);
  assertEquals(cells.length, rows * columns);
});

Deno.test("trailing axes are derived from rank, not assumed", () => {
  assertEquals(trailingMatrixRequest("t", [16, 8, 5, 5]), {
    target: { kind: "tensor", tensorId: "t" },
    axes: [2, 3],
    fixedIndices: { 0: 0, 1: 0 },
  });
  assertEquals(trailingMatrixRequest("t", [4, 4]), {
    target: { kind: "tensor", tensorId: "t" },
    axes: [0, 1],
    fixedIndices: {},
  });
  assertEquals(trailingMatrixRequest("t", [4]), {
    target: { kind: "tensor", tensorId: "t" },
    axes: [0],
    fixedIndices: {},
  });
});

Deno.test("a summary-only product yields no matrix chart", () => {
  assertEquals(
    tensorMatrixChart({
      kind: "matrix_content",
      target: { kind: "tensor", tensorId: "t0" },
      representation: "summary",
      descriptor: {
        id: "t0",
        dtype: "f32",
        shape: [4, 4],
        role: "parameter",
      },
      diagnostics: [],
    }),
    undefined,
  );
});
