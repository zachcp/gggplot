/** @jsxRuntime classic */
// A point mark whose mapped color/size/alpha are GPU scale bindings
// (gggplot-fbq). The compiler hands it positions, per-vertex owners
// (gggplot-8e1) and each mapped column's raw values; the trained domains come
// from the root's stable refs (GGScalesContext.gpu). A retrain therefore
// writes uniforms only: no mark upload, no relink, no pipeline rebuild.
//
// Rendered with workbench's PointLayer because @use-gpu/plot's <Point> drops a
// shader-bound `colors` prop at parse time. PointLayer's defaults (circle,
// opaque) are what <Point> passes, so the pixels match the CPU-packed mark.
import type { LiveElement } from "@use-gpu/live";
import type { FlatTensor } from "../compile/rendertree.ts";
import { parseColorRGBA } from "../color/mod.ts";
import { withMarkAttribution } from "./gpu_instrument.ts";
import {
  ALPHA_BINDING,
  COLOR_BINDING,
  type ScaleBindingRefs,
  SIZE_BINDING,
} from "./scale_bindings.ts";
import {
  createElement,
  PointLayer,
  useContext,
  useLambdaSource,
  useMemo,
  useOne,
  useRawSource,
  useRawTensorSource,
  useShader,
} from "../runtime/usegpu_compat.ts";
import {
  GGScalesContext,
  type GGScalesValue,
} from "../components/gg_scales.ts";

export interface BoundPointProps {
  positions: FlatTensor;
  owners: Uint32Array;
  /** Mapped color values per prepared row, and which scale they use. */
  color?: { values: Float32Array; aes: "color" | "fill" };
  size?: { values: Float32Array };
  alpha?: { values: Float32Array };
  /** Unmapped fallbacks. */
  fixedColor?: string;
  fixedSize?: number;
  [prop: string]: unknown;
}

const ONE = { current: 1 };

/** Uploads a typed array once per identity, attributed to mark data. */
function useMarkSource(array: Float32Array | Uint32Array, format: string) {
  return withMarkAttribution(() => useRawSource(array, format));
}

/**
 * The hooks below run in a fixed order for a given set of mapped aesthetics;
 * the compiler keys the node by that set, so a change remounts instead.
 */
export const BoundPoint = (props: BoundPointProps): LiveElement => {
  const {
    positions,
    owners,
    color,
    size,
    alpha,
    fixedColor,
    fixedSize,
    ...rest
  } = props;
  const scales = useContext<GGScalesValue | null>(GGScalesContext);
  const refs = scales?.gpu as ScaleBindingRefs | undefined;
  if (!refs) {
    throw new Error("[gggplot] a bound point needs a <GGPlot> root above it");
  }
  const n = positions.length;
  const positionSource = withMarkAttribution(() =>
    useRawTensorSource({
      array: positions.array,
      format: positions.format,
      size: positions.size,
      version: 0,
    })
  );
  const ownerSource = useMarkSource(owners, "u32");
  const lambdaProps = useOne(() => ({ length: n }), n);

  const alphaValues = alpha ? useMarkSource(alpha.values, "f32") : null;
  const alphaFn = alpha
    ? useShader(ALPHA_BINDING, [
      alphaValues,
      ownerSource,
      refs.alpha.domain,
      refs.alpha.range,
    ])
    : ONE;

  let colorProp: Record<string, unknown>;
  if (color) {
    const colorRefs = refs[color.aes];
    const values = useMarkSource(color.values, "f32");
    const palette = useRawSource(colorRefs.palette, "vec4<f32>");
    const paletteLength = useMemo(
      () => ({ current: colorRefs.palette.length / 4 }),
      [colorRefs.palette],
    );
    const bound = useShader(COLOR_BINDING, [
      values,
      ownerSource,
      colorRefs.domain,
      palette,
      paletteLength,
      alphaFn,
      colorRefs.naColor,
    ]);
    colorProp = { colors: useLambdaSource(bound, lambdaProps) };
  } else {
    // An unmapped color with a bound alpha still needs per-vertex alpha, so
    // it is a constant color through the same binding shape: not supported
    // here; the compiler only binds alpha together with color.
    colorProp = { color: parseColorRGBA(fixedColor ?? "#3b82f6") };
  }

  let sizeProp: Record<string, unknown>;
  if (size) {
    const values = useMarkSource(size.values, "f32");
    const bound = useShader(SIZE_BINDING, [
      values,
      ownerSource,
      refs.size.domain,
      refs.size.range,
    ]);
    sizeProp = { sizes: useLambdaSource(bound, lambdaProps) };
  } else {
    sizeProp = { size: fixedSize ?? 5 };
  }

  return createElement(PointLayer, {
    ...rest,
    positions: positionSource,
    count: n,
    ...colorProp,
    ...sizeProp,
  });
};
