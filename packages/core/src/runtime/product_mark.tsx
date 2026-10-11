/** @jsxRuntime classic */
// A resident product drawn inside the panel (gggplot-vnh.5.1): the mark the
// component root lays out in place of CPU-lowered geometry for a layer whose
// stat runs on the GPU. The product comes from the ProductHost above the plot
// by key; the panel owns the range, so this contributes the geometry only.
import type { LiveElement } from "@use-gpu/live";
import { ResidentHistogramBars } from "./resident_bar.tsx";
import { ResidentHistogramTiles } from "./resident_tile.tsx";
import { useResidentProduct } from "./resident_products.ts";
import { createElement } from "./usegpu_compat.ts";

export interface ProductMarkProps {
  /** The product's key (product_host.tsx productKey). */
  productKey: string;
  /** Bars over the grid, or its dense [group, bin] tile strip. */
  form: "bars" | "tiles";
  color: string;
  opacity?: number;
  /**
   * The data version whose read-back domain this mark was laid out under.
   * While the product runs ahead of it, the mark draws nothing rather than
   * one generation's geometry under another's axes (gggplot-wkc).
   */
  domainVersion?: number;
}

export const ProductMark = (
  { productKey, form, color, opacity, domainVersion }: ProductMarkProps,
): LiveElement => {
  const product = useResidentProduct(productKey);
  // Null while the product resolves (stat_bin reads its bounds back first).
  if (!product) return null;
  if (domainVersion !== undefined && product.version !== domainVersion) {
    return null;
  }
  return form === "tiles"
    ? createElement(ResidentHistogramTiles, {
      product,
      color,
      opacity,
      colors: product.heatmapColors,
    })
    : createElement(ResidentHistogramBars, {
      product,
      color,
      opacity,
      colors: product.barColors,
    });
};
