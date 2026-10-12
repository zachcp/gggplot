/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
import * as Jsx from "@gggplot/core/jsx";
import { GeomCol, GeomRaster, Labs, ThemeMinimal } from "@gggplot/core";
import type { LiveElement } from "@use-gpu/live";
import { SitePlot } from "./site_plot.tsx";
import type {
  ModelDocument,
  TensorContentProduct,
} from "@gggplot/model-inspect";

/**
 * View builders that lower inspection products into gggplot component trees.
 *
 * These live beside the docs site rather than inside @gggplot/model-inspect:
 * the package is renderer-neutral and has no dependency on @gggplot/core, and
 * keeping the grammar on this side of the boundary is what lets the same
 * products drive a different renderer later.
 */

/** Representations that carry a numeric grid rather than only a summary. */
export function hasMatrixCells(product: TensorContentProduct): boolean {
  return product.values !== undefined && product.gridShape !== undefined &&
    product.gridShape[0] > 0 && product.gridShape[1] > 0;
}

/**
 * Lower `matrix_content` into a heatmap.
 *
 * The product has already applied its budget, so whatever arrives here is
 * bounded — exact, a tile, or a downsample. The view deliberately does not
 * re-read the source or resize anything: if the policy decided a tensor was
 * too large to show cell-by-cell, that decision stays made, and the caller
 * renders the summary instead.
 */
export function tensorMatrixChart(
  product: TensorContentProduct,
): LiveElement | undefined {
  if (!hasMatrixCells(product)) return undefined;
  const values = product.values!;
  const [rows, columns] = product.gridShape!;
  const cells: { row: number; column: number; value: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const value = values[row * columns + column];
      if (value === undefined) continue;
      // Rows read top-down, the way a matrix is written, so flip against the
      // upward y axis rather than presenting the tensor upside down.
      cells.push({ row: rows - 1 - row, column, value });
    }
  }
  if (cells.length === 0) return undefined;
  const name = product.descriptor.name ?? product.descriptor.id;
  return (
    <SitePlot data={cells} mapping={{ x: "column", y: "row", fill: "value" }}>
      <GeomRaster />
      <Labs
        title={`${name} · ${product.representation}`}
        x="column"
        y="row"
        fill="value"
      />
      <ThemeMinimal />
    </SitePlot>
  );
}

/**
 * Build the view request for a tensor's trailing two axes.
 *
 * The bounded matrix view only supports trailing display axes: ask for
 * `[0, 1]` on a 4D weight and the product quietly comes back as `metadata`
 * with a diagnostic rather than failing, which is easy to mistake for "this
 * tensor has no content". Deriving the axes from the rank removes that trap.
 */
export function trailingMatrixRequest(
  tensorId: string,
  shape: readonly unknown[],
): {
  target: { kind: "tensor"; tensorId: string };
  axes: [number] | [number, number];
  fixedIndices: Record<number, number>;
} {
  const rank = shape.length;
  const fixedIndices: Record<number, number> = {};
  for (let axis = 0; axis < rank - 2; axis++) fixedIndices[axis] = 0;
  return {
    target: { kind: "tensor", tensorId },
    axes: rank <= 1 ? [0] : [rank - 2, rank - 1],
    fixedIndices,
  };
}

export interface TensorInventoryEntry {
  tensorId: string;
  label: string;
  byteLength: number;
}

/**
 * Rank parameter tensors by stored size.
 *
 * This is the shape/size view: it answers "where does this model's weight
 * budget actually go" from descriptors alone, so it costs nothing to draw and
 * needs no payload read at all.
 */
export function tensorInventory(
  document: ModelDocument,
  limit = 12,
): TensorInventoryEntry[] {
  return Object.values(document.tensors)
    .filter((tensor) =>
      tensor.role === "parameter" && (tensor.byteLength ?? 0) > 0
    )
    .map((tensor) => ({
      tensorId: tensor.id,
      label: tensor.name ?? tensor.id,
      byteLength: tensor.byteLength ?? 0,
    }))
    .sort((a, b) =>
      b.byteLength - a.byteLength || a.tensorId.localeCompare(b.tensorId)
    )
    .slice(0, limit);
}

export function tensorInventoryChart(
  document: ModelDocument,
  limit = 12,
): LiveElement | undefined {
  const entries = tensorInventory(document, limit);
  if (entries.length === 0) return undefined;
  const rows = entries.map((entry) => ({
    tensor: entry.label,
    kilobytes: entry.byteLength / 1024,
  }));
  return (
    <SitePlot data={rows} mapping={{ x: "tensor", y: "kilobytes" }}>
      <GeomCol fill="#60a5fa" />
      <Labs title="Parameter bytes by tensor" x="tensor" y="KiB" />
      <ThemeMinimal />
    </SitePlot>
  );
}
