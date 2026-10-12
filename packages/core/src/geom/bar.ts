import { resolveHistogram1dBins } from "@gggplot/reductions";
import { lowerPrism3d } from "./surface_3d.ts";
// geom_bar / geom_col — stacked/dodged/filled rectangle Polygons.
//
// The GPU-side grid-to-bar topology adapter (createHistogramBarTopologyPlan)
// lives here too: it is the resident-render counterpart of the CPU bar
// lowering below, consuming the resident stat_bin grid instead of row data.
import type { Aes, DataFrame, GGSpec, Layer } from "../ir/types.ts";
import type { TypedDataFrame } from "../data/mod.ts";
import { node, type RenderNode } from "../compile/rendertree.ts";
import {
  scaleColorValue,
  scalePosition,
  type TrainedScale,
} from "../scale/mod.ts";
import {
  widenForStackedBars,
  widenForTileAxis,
} from "../compile/coordinates.ts";
import {
  dodge2Bars,
  dodgeBars,
  type PositionedBar,
  stackBars,
} from "../position/mod.ts";
import type { ProductPlan } from "../plan/mod.ts";
import {
  RESIDENT_STAT_BIN_PRODUCT,
  RESIDENT_STAT_COUNT_PRODUCT,
  type ResidentCountPlanProps,
  type ResidentHistogramPlanProps,
} from "./resident_plans.ts";
import type {
  DomainContributionCtx,
  LayerContext,
  ResidentProductProps,
} from "./types.ts";
import {
  explicitDomain,
  residentBinRequest,
  residentColorGroups,
  scaleOrderedFactor,
} from "./resident_shared.ts";
import {
  type FaceLoop,
  packFaceLoops,
  resolutionOf,
  valuesOf,
  withOwners,
} from "./shared.ts";

/** Lower a geom_bar/geom_col layer to a single ChunkedFace node of bar-rectangle loops (gggplot-tzc.4), stacked/dodged/filled per layer.position. */
export function lowerBar(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: LayerContext,
): RenderNode[] {
  if (mapping.z != null) return lowerPrism3d(layer, mapping, data, ctx);
  const xScale = ctx.scales.x;
  const yScale = ctx.scales.y;
  const colorScale = ctx.scales.color;
  const fillScale = ctx.scales.fill;

  const xs = valuesOf(data, mapping.x);
  const ys = valuesOf(data, mapping.y);
  if (!xs || !ys || xs.length === 0 || ys.length === 0) return [];

  const n = Math.min(xs.length, ys.length);
  const groupCol = mapping.fill ?? mapping.color ?? mapping.group;
  const groupValues = valuesOf(data, groupCol);

  const scaledX = xs.map((v) => scalePosition(xScale, v));
  const bars: PositionedBar[] = [];
  for (let i = 0; i < n; i++) {
    bars.push({
      x: scaledX[i],
      y: scalePosition(yScale, ys[i]),
      groupKey: groupValues ? String(groupValues[i]) : "__single__",
    });
  }

  const width = barWidth(data, xScale, scaledX);
  const placed = layer.position === "dodge2"
    ? dodge2Bars(
      bars.map((bar) => ({
        ...bar,
        width: typeof layer.params.width === "number"
          ? layer.params.width
          : undefined,
      })),
      width,
      (layer.params.padding as number) ?? 0.1,
    )
    : layer.position === "dodge"
    ? dodgeBars(bars, width)
    : stackBars(
      bars,
      width,
      layer.position === "fill"
        ? "fill"
        : layer.position === "identity"
        ? "identity"
        : "stack",
    );

  const isFillMapped = groupCol &&
    (mapping.fill === groupCol || mapping.color === groupCol);
  const fillOf = (groupKey: string) =>
    isFillMapped
      ? scaleColorValue(
        mapping.fill === groupCol ? fillScale : colorScale,
        groupKey,
      )
      : (layer.params.fill as string) ?? (layer.params.color as string) ??
        "#3b82f6";

  const positions = placed.map((bar): [number, number][] => {
    const x0 = bar.x + bar.xOffset - bar.width / 2;
    const x1 = bar.x + bar.xOffset + bar.width / 2;
    return [[x0, bar.y0], [x0, bar.y1], [x1, bar.y1], [x1, bar.y0]];
  });
  const fills = placed.map((bar) => fillOf(bar.groupKey));
  if (positions.length === 0) return [];
  // gggplot-tzc.4: one ChunkedFace node per layer — packFaceLoops keeps each
  // bar an independent closed loop (chunked, not a single multi-loop
  // surface), so the live/emitted triangulator never bridges one bar's top
  // edge to the next and fills the complement between bars. Bar rectangles
  // are always axis-aligned (guaranteed convex), so this uses fan
  // triangulation (concave: false) — see render/chunked_face.tsx's spike
  // writeup for why this stays valid even after polar (coxcomb) munching.
  // stack/dodge/dodge2 all return placed[i] for input row i, so each bar's
  // four vertices are owned by its row (gggplot-8e1).
  const loops: FaceLoop[] = positions.map((position, i) => ({
    positions: position,
    fill: fills[i],
    owners: [i, i, i, i],
  }));
  const packed = packFaceLoops(loops);
  return [
    withOwners(
      node("ChunkedFace", {
        positions: packed.positions,
        topology: packed.topology,
        colors: packed.colors,
        concave: false,
      }),
      packed.owners,
    ),
  ];
}

/**
 * geom_bar/geom_col domain contribution: widen y to cover stacked/filled bar
 * totals (widenForStackedBars — a no-op for dodge/identity positions beyond
 * clamping the baseline to 0) and widen x by the 0.9-resolution bar band so
 * edge bars aren't clipped by the trained (point-based) x domain.
 */
export function barDomainContribution(
  layer: Layer,
  mapping: Aes,
  data: DataFrame,
  ctx: DomainContributionCtx,
): { x?: [number, number]; y?: [number, number] } | undefined {
  const yDomain = widenForStackedBars(
    ctx.yDomain,
    layer,
    mapping,
    data,
    ctx.xScale,
    ctx.yScale,
  );
  let xDomain = ctx.xDomain;
  const residentBins = layer.stat === "bin" && !valuesOf(data, "width")
    ? residentBinRequest(layer.params)
    : undefined;
  if (residentBins) {
    // A GPU-resident histogram's rows are the raw x values, not bins. Its
    // grid spans [lo, lo + bins * binwidth] over the trained x range (the
    // kernel's own geometry), and that is the x range, as the CPU stat's
    // bars give it.
    const [lo, hi] = xDomain;
    const { bins, binwidth } = resolveHistogram1dBins({
      lo,
      hi,
      ...residentBins,
    });
    xDomain = [lo, Math.max(hi, lo + bins * binwidth)];
  } else if (mapping.x) {
    const scaledX = (valuesOf(data, mapping.x) ?? []).map((v) =>
      scalePosition(ctx.xScale, v)
    );
    const width = barWidth(data, ctx.xScale, scaledX);
    xDomain = widenForTileAxis(xDomain, scaledX, width);
  }
  return { x: xDomain, y: yDomain };
}

/**
 * A bar's width in x: the stat's `width` column when it reports one, as
 * stat_bin does with its binwidth so histogram bars span their bin and touch
 * (ggplot2's geom_bar reads data$width first), else 0.9 of the x resolution.
 */
function barWidth(
  data: DataFrame,
  xScale: TrainedScale | undefined,
  scaledX: number[],
): number {
  const reported = (valuesOf(data, "width") ?? []).find(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  return reported ?? resolutionOf(xScale, scaledX) * 0.9;
}

/**
 * geom_bar's GPU-resident capability: the first safe resident lowering contract
 * for an eligible stat_bin layer, or undefined when the CPU compiler must stay
 * authoritative. An automatic y-domain is read back off the GPU by the root
 * (`autoYDomain`) rather than materializing stat rows.
 *
 * A fill/color mapping is resident-eligible IFF (a) the mapped column is a
 * factor column in the data, (b) it is the same column the group derivation
 * uses (fill/color takes precedence over group, so it directly drives
 * groupIds), and (c) the spec declares no custom scale for that aesthetic. When
 * eligible, one hex color per factor level (level order) is emitted as
 * `paletteColors` for on-GPU per-group bar coloring; every other mapping still
 * falls back to the CPU lowering.
 */
export function barResidentPlan(
  spec: GGSpec,
  layer: Layer,
  mapping: Aes,
  data: TypedDataFrame,
  opts: { standalone: boolean },
): ResidentProductProps | undefined {
  const allowAutomaticY = opts.standalone;
  if (
    spec.execution?.resident === false ||
    spec.coord.kind !== "cartesian" || spec.facet.kind !== "none" ||
    layer.geom !== "bar" || !["bin", "count"].includes(layer.stat) ||
    !["identity", "stack", "dodge", "fill"].includes(layer.position) ||
    mapping.y || "weight" in layer.params ||
    (!allowAutomaticY && !explicitDomain(spec, "y"))
  ) return undefined;
  const position = layer.position as "identity" | "stack" | "dodge" | "fill";

  // Shared fill/color eligibility + grouping (resident_shared.ts): factor
  // column with a default scale driving groupIds, or CPU fallback.
  const colorGroups = residentColorGroups(spec, mapping, data);
  if (!colorGroups) return undefined;
  const { group, groupsCount, paletteColors } = colorGroups;

  const x = mapping.x;
  const xColumn = x ? data[x] : undefined;
  if (!x || !xColumn) return undefined;
  if (layer.stat === "count") {
    if (xColumn.type !== "factor") return undefined;
    // The grid's slot i must be the trained x scale's level i (gggplot-mos5).
    const ordered = scaleOrderedFactor(spec, data, x);
    const orderedX = ordered[x] as typeof xColumn;
    const nodeProps: ResidentCountPlanProps = {
      data: ordered,
      x,
      group,
      options: {
        valuesCount: orderedX.levels.length,
        groupsCount,
        position,
      },
      color: (layer.params.fill as string) ?? (layer.params.color as string) ??
        "#3b82f6",
      opacity: layer.params.alpha as number | undefined,
      paletteColors,
      autoYDomain: allowAutomaticY && !explicitDomain(spec, "y"),
    };
    return {
      product: RESIDENT_STAT_COUNT_PRODUCT,
      props: nodeProps as unknown as Record<string, unknown>,
    };
  }
  if (xColumn.type !== "numeric") return undefined;
  const binRequest = residentBinRequest(layer.params);
  if (!binRequest) return undefined;

  const xDomain = explicitDomain(spec, "x");
  const nodeProps: ResidentHistogramPlanProps = {
    data,
    x,
    group,
    options: xDomain
      ? { lo: xDomain[0], hi: xDomain[1], ...binRequest, groupsCount, position }
      : { autoDomain: true, ...binRequest, groupsCount, position },
    color: (layer.params.fill as string) ?? (layer.params.color as string) ??
      "#3b82f6",
    opacity: layer.params.alpha as number | undefined,
    paletteColors,
    autoYDomain: allowAutomaticY && !explicitDomain(spec, "y"),
  };
  return {
    product: RESIDENT_STAT_BIN_PRODUCT,
    props: nodeProps as unknown as Record<string, unknown>,
  };
}

export interface HistogramBarTopologyOptions {
  position: "identity" | "stack" | "dodge" | "fill";
}

/**
 * GPU-side grid-to-bar adapter. It consumes the resident stat_bin grid and
 * produces mark topology, never CPU row-shaped count data.
 */
export function createHistogramBarTopologyPlan(
  options: HistogramBarTopologyOptions = { position: "stack" },
): ProductPlan {
  return {
    id: "@gggplot/core:geom_histogram_grid@1",
    kind: "geom",
    executor: "gpu",
    inputs: [
      { field: "count", access: "read" },
      { field: "bin_center", access: "read" },
    ],
    outputs: [
      {
        name: "bar_positions",
        dtype: "f32",
        shape: "row",
        dimensions: ["group", "bin", "corner", "axis"],
        role: "output",
      },
      {
        name: "bar_faces",
        dtype: "u32",
        shape: "topology",
        dimensions: ["group", "bin", "triangle", "index"],
        role: "topology",
      },
    ],
    dependencies: ["@gggplot/core:stat_bin@1", `position:${options.position}`],
  };
}

/** Categorical count-grid variant of the shared resident bar topology contract. */
export function createCountBarTopologyPlan(
  options: HistogramBarTopologyOptions = { position: "stack" },
): ProductPlan {
  const plan = createHistogramBarTopologyPlan(options);
  return {
    ...plan,
    id: "@gggplot/core:geom_count_grid@1",
    inputs: [{ field: "count", access: "read" }],
    outputs: plan.outputs.map((field) => ({
      ...field,
      dimensions: field.dimensions.map((dimension) =>
        dimension === "bin" ? "category" : dimension
      ),
    })),
    dependencies: [
      "@gggplot/core:stat_count@1",
      `position:${options.position}`,
    ],
  };
}
