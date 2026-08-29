/** @jsxRuntime classic */
/** @jsx createElement */
// GPU-native text rotation for Plot labels. Workbench's stock LabelLayer has
// no angle trait, so this keeps its glyph/SDF pipeline and replaces only the
// glyph attachment shader.

import * as Live from "@use-gpu/live";
import * as Workbench from "@use-gpu/workbench";
import { wgsl } from "@use-gpu/shader/wgsl";
import {
  getViewResolution,
  getWorldScale,
  worldToClip,
} from "@use-gpu/wgsl/use/view.wgsl";

const attachRotatedLabelTo = wgsl`
  @link fn getPosition(i: u32) -> vec4<f32>;
  @link fn getAngle() -> f32;
  @link fn getViewResolution() -> vec2<f32>;
  @link fn getWorldScale(d: f32, z: f32) -> f32;
  @link fn worldToClip(p: vec4<f32>) -> vec4<f32>;

  @export fn attachRotatedLabelTo(
    i: u32,
    shape: vec2<f32>,
    origin: vec2<f32>,
    rectangle: vec4<f32>,
    xy: vec2<f32>,
    depth: f32,
    scale: f32,
    offset: vec2<f32>,
    flip: vec2<f32>,
  ) -> vec4<f32> {
    let center = worldToClip(getPosition(i));
    let worldScale = getWorldScale(center.w, depth) * scale;
    let local = 2.0 * ((xy + origin) * worldScale + offset) * flip;
    let angle = getAngle();
    let c = cos(angle);
    let s = sin(angle);
    let rotated = vec2<f32>(
      c * local.x - s * local.y,
      s * local.x + c * local.y,
    );
    return vec4<f32>(
      center.xy + rotated * getViewResolution() * center.w,
      center.zw,
    );
  };
`;

const POSITION_SOURCE = { format: "vec4<f32>", name: "getPosition" };

// The public Workbench barrel exports these primitives/hooks, but their broad
// generic signatures make a small structural adapter clearer at this boundary.
const {
  GlyphSource,
  RawLabels,
  RAW_LABEL_SCHEMA,
  useAggregator,
  useApplyTransform,
  useSDFFontContext,
  useShader,
  useShaderRef,
  useSource,
  // deno-lint-ignore no-explicit-any
} = Workbench as Record<string, any>;

const { gather, memo, use, useMemo, useOne } = Live;

/** LabelLayer-compatible component with an angle in degrees. */
// deno-lint-ignore no-explicit-any
export const RotatedLabel = memo((props: Record<string, any>) => {
  const {
    angle = 0,
    position,
    positions,
    label,
    labels,
    family,
    weight,
    style,
    transform,
    monochrome,
    detail,
    count: _count,
    mode = "opaque",
    ...rest
  } = props;
  const strings = useOne(
    () => labels ?? (label != null ? [label] : []),
    labels ?? label,
  );
  const positionSource = useSource(
    POSITION_SOURCE,
    useShaderRef(position, positions),
  );
  const { positions: getPosition } = useApplyTransform(
    positionSource,
    transform,
  );
  const getAngle = useShaderRef(Number(angle) * Math.PI / 180);
  const attachTo = useShader(attachRotatedLabelTo, [
    getPosition,
    getAngle,
    getViewResolution,
    getWorldScale,
    worldToClip,
  ]);

  return gather(
    use(GlyphSource, {
      family,
      weight,
      style,
      strings,
      size: detail,
      monochrome,
    }),
    // deno-lint-ignore no-explicit-any
    ([data]: any[]) => {
      if (!data || data.count === 0) return null;
      const { count, sdf } = data;
      const { getTexture } = useSDFFontContext();
      const items = useMemo(() => [{
        count,
        attributes: data,
        archetype: 0,
      }], [data, count]);
      const aggregate = useAggregator(RAW_LABEL_SCHEMA, items);
      return use(RawLabels, {
        count,
        ...aggregate.sources,
        sdf,
        texture: getTexture(),
        attachTo,
        mode,
        ...rest,
      });
    },
  );
}, "RotatedLabel");
