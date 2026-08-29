// Source-emit backend — turns a RenderTree into standalone UseGPU Live .tsx
// source. This is the literal "transpiler": ggplot spec in, UseGPU JSX out.

import type { ComponentName, RenderNode } from "../compile/rendertree.ts";
import { facetCellLayouts } from "../compile/facet_layout.ts";

const PLOT_IMPORTS: ComponentName[] = [
  "Plot",
  "Embedded",
  "Cartesian",
  "Polar",
  "Axis",
  "Tick",
  "Grid",
  "Point",
  "Line",
  "Face",
  "Polygon",
  "Label",
  "ScissorBox",
];

const SCENE_3D_SOURCE = `
const CameraOrbitContext = makeContext({ bearing: 0, pitch: 0 }, "CameraOrbitContext");
const axisIndex3d = (axis: string): 0 | 1 | 2 => axis === "x" ? 0 : axis === "y" ? 1 : 2;

const CameraAxis3D = (props: any): any => {
  const { bearing, pitch } = useContext(CameraOrbitContext);
  const axis = props.axis;
  const axisIndex = axisIndex3d(axis);
  const { domains, range, values } = props;
  const direction = [
    Math.sin(bearing) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(bearing) * Math.cos(pitch),
  ];
  const origin = domains.map((domain: [number, number], index: number) =>
    direction[index] >= 0 ? domain[1] : domain[0]
  );
  const positions = values.map((value: number) => {
    const position = [...origin, 1];
    position[axisIndex] = value;
    return position;
  });
  const offsetIndex = axis === "y" ? 0 : 1;
  const offsetSign = origin[offsetIndex] === domains[offsetIndex][0] ? -1 : 1;
  const offset = [0, 0, 0, 0];
  offset[offsetIndex] = offsetSign;
  const tangent = [0, 0, 0, 0];
  tangent[axisIndex] = positions.length > 1
    ? (range[1] - range[0]) / (positions.length - 1)
    : 1;
  const labelOffset = axis === "y" ? [offsetSign * 7, 0] : [0, offsetSign * 7];
  const titleDistance = 5 + props.fontSize * 2.5;
  const titleOffset = axis === "y"
    ? [offsetSign * titleDistance, 0]
    : [0, offsetSign * titleDistance];
  const face = {
    ...(props.family ? { family: props.family } : {}),
    ...(props.weight ? { weight: props.weight } : {}),
    ...(props.style ? { style: props.style } : {}),
  };
  const titlePosition = [...origin, 1];
  titlePosition[axisIndex] = (range[0] + range[1]) / 2;
  return createElement(
    Fragment,
    {},
    createElement(Axis, { axis, origin, range, color: props.axisColor, width: props.axisWidth, zBias: 0 }),
    positions.length ? createElement(Tick, {
      positions, offset, tangent, size: 5, color: props.axisColor,
      width: props.axisWidth, depth: 0, zBias: 1,
    }) : null,
    positions.length ? createElement(Label, {
      positions, labels: props.labels, color: props.textColor,
      size: props.tickSize, depth: 0, placement: props.placement,
      offset: labelOffset, zBias: 2, ...face,
    }) : null,
    props.title ? createElement(Label, {
      position: titlePosition, label: props.title, color: props.textColor,
      size: props.fontSize, depth: 0, placement: props.placement,
      offset: titleOffset, zBias: 2, ...face,
    }) : null,
  );
};

// RenderTree's first child is the camera-space scene; its second is the flat
// page-furniture overlay. One canonical camera seeds runtime-only controls.
const Scene3D = ({ camera, children }: any): any => {
  const kids = Array.isArray(children) ? children : children != null ? [children] : [];
  const scene = kids[0] ?? null;
  const overlay = kids[1] ?? null;
  return createElement(
    Fragment,
    {},
    createElement(
      OrbitControls,
      { radius: camera.radius, bearing: camera.bearing, pitch: camera.pitch, target: camera.target },
      (radius: number, bearing: number, pitch: number, target: any) =>
        createElement(
          OrbitCamera,
          { radius, bearing, pitch, target, fov: camera.fov, near: camera.near, far: camera.far },
          createElement(
            Pass,
            {},
            provide(CameraOrbitContext, { bearing, pitch }, scene),
          ),
        ),
    ),
    createElement(FlatCamera, {}, createElement(Pass, { overlay: true }, overlay)),
  );
};
`;

const POINT_3D_SOURCE = `
// use.gpu's vec4 data trait consumes an explicit WGSL format.
const Point3D = (props: any): any => createElement(Point, {
  ...props,
  positions: { ...props.positions, format: "vec4<f32>" },
});
`;

// "FacetGrid" isn't a real @use-gpu/plot export (see rendertree.ts and
// render/GGPlot.tsx's Live implementation, which this mirrors) — when a
// faceted spec uses it, emitSource inlines this plain-JS definition plus its
// extra imports so the generated module is still standalone.
// FacetPanel wraps one facet cell (or, for a single-panel chart, the sole
// panel) — always emitted when the tree carries a FacetPanel node, independent
// of whether a FacetGrid is present.
const FACET_PANEL_SOURCE = `
const FacetPanel = ({ children }: any): any => createElement(Fragment, {}, children);
`;

// The emitted FacetGrid embeds the COMPILED facetCellLayouts function itself
// (gggplot-q24): the grid math exists exactly once, in compile/facet_layout.ts,
// and the generated module can never drift from the live FacetGrid in
// render/GGPlot.tsx, which calls the same function. toString() yields the
// runtime's transpiled (type-stripped) JS, which is valid inside the emitted
// .tsx module and keeps it standalone.
const FACET_GRID_SOURCE = `
// Not a real @use-gpu/plot export -- divides the ambient LayoutContext pixel
// rect into an nrow x ncol grid and applies a normalized PanelViewport matrix
// while all panels share the outer Embedded/Plot reconciler. Cell rectangles
// come from the embedded facetCellLayouts, the same function the live
// backend's FacetGrid uses.
${facetCellLayouts.toString()}
const FacetGrid = ({ nrow, ncol, gap = 24, stripHeight = 24, bounds = [-1, -1, 1, 1], children }: any): any => {
  const kids = Array.isArray(children) ? children : children != null ? [children] : [];
  const [left, top, right, bottom] = useContext(LayoutContext);
  const hostWidth = Math.max(right - left, 1);
  const hostHeight = Math.max(bottom - top, 1);
  const width = hostWidth * (bounds[2] - bounds[0]) / 2;
  const height = hostHeight * (bounds[3] - bounds[1]) / 2;
  const layouts = facetCellLayouts(width, height, nrow, ncol, gap, stripHeight);
  return createElement(
    Fragment,
    {},
    ...kids.map((child, i) => {
      const panel = layouts[i].panel;
      const cellBounds = [
        bounds[0] + panel[0] / width * (bounds[2] - bounds[0]),
        bounds[1] + panel[1] / height * (bounds[3] - bounds[1]),
        bounds[0] + panel[2] / width * (bounds[2] - bounds[0]),
        bounds[1] + panel[3] / height * (bounds[3] - bounds[1]),
      ];
      return createElement(PanelViewport, { bounds: cellBounds }, child);
    }),
  );
};
`;

const RADIAL_VIEWPORT_SOURCE = `
// Keeps polar geometry circular inside a non-square host canvas.
const RadialViewport = ({ children }: any): any => {
  const [left, top, right, bottom] = useContext(LayoutContext);
  const aspect = (bottom - top) / (right - left);
  const matrix = useMemo(() => new Float32Array([
    aspect, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]), [aspect]);
  const [context, combined] = useCombinedMatrixTransform(matrix);
  return provide(MatrixContext, combined, provide(TransformContext, context, children));
};
`;

const PANEL_VIEWPORT_SOURCE = `
// Insets a plot panel while labels remain in the outer normalized chart.
const PanelViewport = ({ bounds, children }: any): any => {
  const [x0, y0, x1, y1] = bounds;
  const matrix = useMemo(() => new Float32Array([
    (x1 - x0) / 2, 0, 0, 0,
    // NEGATIVE y: plot's Cartesian is y-up, the surrounding overlay is y-down.
    // See render/GGPlot.tsx's PanelViewport for the full derivation
    // (gggplot-8zx) -- LIVE/EMIT PARITY REQUIRED.
    0, -(y1 - y0) / 2, 0, 0,
    0, 0, 1, 0,
    (x0 + x1) / 2, (y0 + y1) / 2, 0, 1,
  ]), [x0, y0, x1, y1]);
  const [context, combined] = useCombinedMatrixTransform(matrix);
  return provide(MatrixContext, combined, provide(TransformContext, context, children));
};
`;

const FONT_HOST_SOURCE = `
// Font URLs and readiness remain host-owned; the generated chart accepts the
// same FontResources shape as GGPlot without embedding resources in its spec.
const EmittedFontHost = ({ fontResources, children }: any): any => {
  const [ready, error] = useAwait(
    fontResources ? async () => {
      await fontResources.ready();
      return true;
    } : null,
    [fontResources],
  );
  if (error) throw error;
  if (fontResources && !ready) return null;
  return fontResources
    ? createElement(FontLoader, { fonts: fontResources.faces }, children)
    : children;
};
`;

/** A number token: integers print exact; floats print with the emitter's
 * default (shortest-round-trip) formatting — the tensors are already Float32-
 * truncated, so this is the emitter's existing rounding, no extra rounding. */
function fmtNumber(n: number): string {
  return Object.is(n, -0) ? "0" : String(n);
}

/** A typed-array literal body: `[v, v, ...]` when 64 values or fewer (one
 * wrapped line), otherwise 8 values per line. NO base64. */
function fmtTypedArray(
  values: ArrayLike<number>,
  indent: string,
): string {
  const toks: string[] = [];
  for (let i = 0; i < values.length; i++) toks.push(fmtNumber(values[i]));
  if (toks.length <= 64) return `[${toks.join(", ")}]`;
  const rows: string[] = [];
  for (let i = 0; i < toks.length; i += 8) {
    rows.push(`${indent}  ${toks.slice(i, i + 8).join(", ")}`);
  }
  return `[\n${rows.join(",\n")}\n${indent}]`;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function objectKey(key: string): string {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}

/** True when `value` holds a typed array anywhere in its structure — the
 * signal to serialize it as executable JS (new Float32Array/new Uint32Array)
 * rather than JSON. FlatTensor 'positions'/'colors'/'widths' and MarkTopology
 * 'chunks'/'indices' are the shapes this catches. */
function containsTypedArray(value: unknown): boolean {
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return true;
  if (Array.isArray(value)) return value.some(containsTypedArray);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(
      containsTypedArray,
    );
  }
  return false;
}

/** Serialize a prop value carrying a typed array (FlatTensor / MarkTopology)
 * to an executable JS literal: Float32Array/Uint32Array for the typed arrays,
 * plain object/array/scalar literals otherwise. Only fields actually present
 * are emitted (undefined is dropped), so MarkTopology never prints an absent
 * 'owners' or other field, and FlatTensor prints exactly its six fields. */
function serializeValue(value: unknown, indent: string): string {
  if (value instanceof Float32Array || value instanceof Float64Array) {
    return `new ${value.constructor.name}(${fmtTypedArray(value, indent)})`;
  }
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    // Any integer typed array (Uint32Array chunks/indices, etc.).
    const ctor = (value as { constructor: { name: string } }).constructor.name;
    return `new ${ctor}(${
      fmtTypedArray(value as unknown as ArrayLike<number>, indent)
    })`;
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => serializeValue(v, indent)).join(", ")}]`;
  }
  if (value === null) return "null";
  if (typeof value === "object") {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      parts.push(`${objectKey(k)}: ${serializeValue(v, indent)}`);
    }
    return `{ ${parts.join(", ")} }`;
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return fmtNumber(value);
  return String(value);
}

// Shared FlatTensor -> raw GPU source helper for the inlined Chunked* marks.
// Mirrors useOptionalTensorSource in render/chunked_line.tsx +
// render/chunked_face.tsx: the paired no-op hook keeps @use-gpu/live's
// hook-call order stable when an optional tensor prop is absent. Params are
// annotated `any` (the emitted module has no access to the compiler-internal
// FlatTensor type) so the standalone module still deno-checks.
//
// gggplot-iti: a toWgslFormat translation used to live here, embedded as a
// STRING inside every generated module and therefore invisible to the type
// checker and to grep-driven refactors alike. FlatTensor.format is now the
// canonical WGSL spelling, so the tensor is passed straight through.
export const TENSOR_SOURCE_SOURCE = `
const useOptionalTensorSource = (tensor: any): any => {
  if (tensor) {
    return useRawTensorSource({
      array: tensor.array,
      format: tensor.format,
      size: tensor.size,
      version: tensor.version,
    });
  }
  useNoRawTensorSource();
  return undefined;
};
`;

// Inlined standalone realization of color/mod.ts's parseColorRGBA. Both raw
// workbench layers below (LineLayer, FaceLayer) take a numeric vec4 color and
// silently render black for a CSS string (gggplot-frg), so the emitted module
// needs the same parse the live components do -- LIVE/EMIT PARITY REQUIRED.
export const SCALAR_COLOR_SOURCE = `
const parseColorRGBA = (color: string, alpha = 1): [number, number, number, number] => {
  const a = Math.max(0, Math.min(1, alpha));
  let hex = (color ?? "").trim().replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return [0, 0, 0, a];
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
    a,
  ];
};
`;

// Inlined standalone realization of RenderTree's 'ChunkedLine' mark, mirroring
// render/chunked_line.tsx: workbench LineLayer + useLineSegmentsSource over a
// packed FlatTensor 'positions' + explicit MarkTopology 'chunks'. Prop shapes
// are kept identical to the live component so both backends render alike.
//
// gggplot-xc9: dash rendering mirrors render/chunked_line.tsx's minimal
// custom WGSL dash material (see that file for the full derivation/
// screen-space-correctness reasoning) -- LIVE/EMIT PARITY REQUIRED: keep
// getDashColorSource, MAX_DASH_SEGMENTS, packDashUniforms, computeArcLengths,
// and ChunkedLine's dash wiring below textually in sync with that file.
export const CHUNKED_LINE_SOURCE = `
const MAX_DASH_SEGMENTS = 4;

const getDashColorSource = wgsl\`
  @link fn getWorldScale(w: f32, f: f32) -> f32;
  @link fn getDashArray() -> vec4<f32>;
  @link fn getDashCount() -> f32;
  @link fn getDashTotal() -> f32;

  @export fn getDashColor(color: vec4<f32>, uv: vec4<f32>, st: vec4<f32>) -> vec4<f32> {
    let total = getDashTotal();
    if (total <= 0.0) {
      return color;
    }

    let pixelsPerWorldUnit = 1.0 / getWorldScale(1.0, 0.0);
    let arc = st.x * pixelsPerWorldUnit;
    var d = arc - floor(arc / total) * total;
    if (d < 0.0) {
      d = d + total;
    }

    let dash = getDashArray();
    let count = u32(getDashCount());

    var acc = 0.0;
    var on = true;
    for (var i = 0u; i < count; i = i + 1u) {
      let seg = dash[i];
      if (d < acc + seg) {
        if (!on) {
          discard;
        }
        return color;
      }
      acc = acc + seg;
      on = !on;
    }

    return color;
  };
\`;

function packDashUniforms(dash: any): any {
  if (!dash || dash.length === 0) return null;
  const segments = dash.slice(0, MAX_DASH_SEGMENTS);
  const array = [0, 0, 0, 0];
  let total = 0;
  for (let i = 0; i < segments.length; i++) {
    array[i] = segments[i];
    total += segments[i];
  }
  return { array, count: segments.length, total };
}

function computeArcLengths(positions: any, chunks: any): any {
  const { array, dims, length, version } = positions;
  const out = new Float32Array(length);
  let vertex = 0;
  for (const chunkLength of chunks) {
    let acc = 0;
    for (let k = 0; k < chunkLength; k++, vertex++) {
      if (k > 0) {
        let sumSq = 0;
        for (let d = 0; d < dims; d++) {
          const delta = array[vertex * dims + d] - array[(vertex - 1) * dims + d];
          sumSq += delta * delta;
        }
        acc += Math.sqrt(sumSq);
      }
      out[vertex] = acc;
    }
  }
  return { array: out, format: "f32", dims: 1, length, size: [length], version };
}

const ChunkedLine = (props: any): any => {
  const { positions, topology, colors, widths, width, color, opacity, dash, ...rest } = props;
  const chunks = topology.chunks ?? Uint32Array.of(positions.length);
  const { count, segments } = useLineSegmentsSource({
    chunks,
    groups: null,
    loops: topology.loops ?? false,
  });
  const positionsSource = useOptionalTensorSource(positions);
  const colorsSource = useOptionalTensorSource(colors);
  const widthsSource = useOptionalTensorSource(widths);

  const dashUniforms = useMemo(() => packDashUniforms(dash), [dash]);
  const arcLengths = useMemo(
    () => dashUniforms ? computeArcLengths(positions, chunks) : undefined,
    [dashUniforms, positions, chunks],
  );
  const stsSource = useOptionalTensorSource(arcLengths);
  const getDashArray = useShaderRef(dashUniforms?.array ?? [0, 0, 0, 0]);
  const getDashCount = useShaderRef(dashUniforms?.count ?? 0);
  const getDashTotal = useShaderRef(dashUniforms?.total ?? 0);
  const getDashColor = useShader(getDashColorSource, [
    getWorldScale,
    getDashArray,
    getDashCount,
    getDashTotal,
  ]);
  const material = useMaterialContext();

  const lineElement = createElement(LineLayer, {
    positions: positionsSource,
    segments,
    count,
    sides: 2,
    ...(colorsSource
      ? { colors: colorsSource }
      : { color: parseColorRGBA(color ?? "#3b82f6", opacity ?? 1) }),
    ...(widthsSource ? { widths: widthsSource } : { width: width ?? 2 }),
    ...(stsSource ? { sts: stsSource } : {}),
    ...rest,
  });

  if (!dashUniforms) return lineElement;

  return provide(
    MaterialContext,
    { ...material, solid: { ...material.solid, getFragment: getDashColor } },
    lineElement,
  );
};
`;

// Inlined standalone realization of RenderTree's 'ChunkedFace' mark, mirroring
// render/chunked_face.tsx: workbench FaceLayer + useFaceSegmentsSource (fan,
// guaranteed-convex families) or useFaceSegmentsConcaveSource (earcut-backed,
// concave families), picked per node by the 'concave' prop fixed at lowering
// time. The ternary-of-hook-and-no-op keeps hook-call order stable across the
// two branches (see render/chunked_face.tsx's header for the rationale).
export const CHUNKED_FACE_SOURCE = `
const ChunkedFace = (props: any): any => {
  const { positions, topology, colors, concave, color, opacity, ...rest } = props;
  const chunks = topology.chunks ?? Uint32Array.of(positions.length);
  const fan = concave
    ? (useNoFaceSegmentsSource(), undefined)
    : useFaceSegmentsSource(chunks);
  const indexed = concave
    ? useFaceSegmentsConcaveSource(chunks, null, positions.array, 2)
    : (useNoFaceSegmentsConcaveSource(), undefined);
  const positionsSource = useOptionalTensorSource(positions);
  const colorsSource = useOptionalTensorSource(colors);
  return createElement(FaceLayer, {
    positions: positionsSource,
    side: "both",
    ...(concave
      ? { indices: indexed.indices }
      : { segments: fan.segments, count: fan.count }),
    ...(colorsSource
      ? { colors: colorsSource, ...(opacity != null ? { opacity } : {}) }
      : { color: parseColorRGBA(color ?? "#3b82f6", opacity ?? 1) }),
    ...rest,
  });
};
`;

/** Workbench hooks each inlined Chunked* definition needs destructured from
 * the loosely-typed namespace import (mirrors render/chunked_*.tsx's
 * `import * as Workbench` structural-adapter convention). */
const CHUNKED_LINE_HOOKS = [
  "LineLayer",
  "useLineSegmentsSource",
  "useShader",
  "useShaderRef",
  "useMaterialContext",
  "MaterialContext",
];
const CHUNKED_FACE_HOOKS = [
  "FaceLayer",
  "useFaceSegmentsSource",
  "useNoFaceSegmentsSource",
  "useFaceSegmentsConcaveSource",
  "useNoFaceSegmentsConcaveSource",
];
const TENSOR_SOURCE_HOOKS = ["useRawTensorSource", "useNoRawTensorSource"];

function formatProp(key: string, value: unknown, indent: string): string {
  if (typeof value === "string") return `${key}=${JSON.stringify(value)}`;
  // FlatTensor / MarkTopology props hold typed arrays JSON cannot represent;
  // emit them as executable Float32Array/Uint32Array literals. All other props
  // keep the exact JSON form the emitter has always produced.
  if (containsTypedArray(value)) {
    return `${key}={${serializeValue(value, indent)}}`;
  }
  return `${key}={${JSON.stringify(value)}}`;
}

function emitNode(n: RenderNode, indent: string): string {
  const props = Object.entries(n.props)
    .map(([k, v]) => formatProp(k, v, indent))
    .join(" ");
  const component = n.component === "Point" &&
      (n.props.positions as { dims?: number } | undefined)?.dims === 4
    ? "Point3D"
    : n.component;
  const open = props ? `${component} ${props}` : component;

  if (n.children.length === 0) return `${indent}<${open} />`;

  const children = n.children.map((c) => emitNode(c, indent + "  ")).join("\n");
  return `${indent}<${open}>\n${children}\n${indent}</${component}>`;
}

/** Collect the plot component names actually used, for a tidy import line. */
function usedComponents(
  root: RenderNode,
  seen = new Set<ComponentName>(),
): Set<ComponentName> {
  seen.add(root.component);
  for (const c of root.children) usedComponents(c, seen);
  return seen;
}

/** Emit a complete, self-contained UseGPU Live component module. */
export function emitSource(root: RenderNode, name = "GGChart"): string {
  const nonSerializable = (current: RenderNode): boolean =>
    current.props.nonSerializable === true ||
    current.children.some(nonSerializable);
  if (nonSerializable(root)) {
    throw new TypeError(
      "[gggplot] emitted source cannot serialize a custom 2D summary reducer; use a built-in reducer",
    );
  }
  const all = usedComponents(root);
  const guideLines = all.has("GuideLines");
  const cameraAxis3d = all.has("CameraAxis3D");
  const used = PLOT_IMPORTS.filter((c) =>
    all.has(c) || (c === "Line" && guideLines) ||
    (cameraAxis3d && (c === "Axis" || c === "Tick" || c === "Label"))
  );
  const faceted = all.has("FacetGrid");
  const radial = all.has("RadialViewport");
  const panelViewport = faceted || all.has("PanelViewport");
  const scene3d = all.has("Scene3D");
  const point3d = (current: RenderNode): boolean =>
    (current.component === "Point" &&
      (current.props.positions as { dims?: number } | undefined)?.dims === 4) ||
    current.children.some(point3d);
  const hasPoint3d = point3d(root);
  // gggplot-xc9: ChunkedLine's dash material needs 'provide' (to scope its
  // MaterialContext override to just its own LineLayer) and 'useMemo' (to
  // memoize the dash-uniform/arc-length derivation) from @use-gpu/live, the
  // same two names radial/panelViewport already pull in for unrelated
  // reasons — folded into one de-duplicated import list below.
  const chunkedLine = all.has("ChunkedLine");

  const needsContext = faceted || radial || panelViewport || cameraAxis3d;
  const needsProvideAndMemo = radial || panelViewport || chunkedLine || scene3d;
  const liveImportNames = [
    "createElement",
    "Fragment",
    ...(scene3d ? ["makeContext"] : []),
    ...(needsProvideAndMemo ? ["provide"] : []),
    "useAwait",
    ...(needsContext ? ["useContext"] : []),
    ...(needsProvideAndMemo ? ["useMemo"] : []),
  ];
  const liveImports = liveImportNames.join(", ");
  const workbenchImports = [
    "FontLoader",
    ...(scene3d ? ["FlatCamera", "OrbitCamera", "Pass"] : []),
    ...(faceted || radial ? ["LayoutContext"] : []),
    ...(radial || panelViewport
      ? ["MatrixContext", "TransformContext", "useCombinedMatrixTransform"]
      : []),
  ];
  const workbenchImport = workbenchImports.length
    ? `\nimport { ${workbenchImports.join(", ")} } from "@use-gpu/workbench";`
    : "";
  const interactImport = scene3d
    ? `\nimport { OrbitControls } from "@use-gpu/interact";`
    : "";
  // FacetPanel is emitted for ANY tree that carries a FacetPanel node — a
  // single-panel chart still wraps its axis labels in one — so its definition
  // is gated on the node's own presence, not on FacetGrid (a faceted tree has
  // both). This keeps the generated module self-contained: every referenced
  // component is defined or imported, so it type-checks standalone.
  const facetPanel = all.has("FacetPanel");
  const facetPanelDef = facetPanel ? `\n${FACET_PANEL_SOURCE}` : "";
  const facetGridDef = faceted ? `\n${FACET_GRID_SOURCE}` : "";
  const radialViewportDef = radial ? `\n${RADIAL_VIEWPORT_SOURCE}` : "";
  const panelViewportDef = panelViewport ? `\n${PANEL_VIEWPORT_SOURCE}` : "";
  const scene3dDef = scene3d ? `\n${SCENE_3D_SOURCE}` : "";
  const point3dDef = hasPoint3d ? `\n${POINT_3D_SOURCE}` : "";
  const guideLinesDef = guideLines ? "\nconst GuideLines = Line;\n" : "";

  // ChunkedLine/ChunkedFace are RenderTree mark ComponentNames, NOT
  // @use-gpu/plot exports — inline their standalone definitions (mirroring the
  // live REGISTRY components in render/chunked_line.tsx + render/chunked_face.tsx)
  // and pull the workbench hooks they need through a loosely-typed namespace
  // import, the same structural-adapter convention the live files use. Plain
  // Line/Point/Polygon guide/annotation nodes stay imported from @use-gpu/plot.
  // (chunkedLine itself is computed above, alongside liveImports.)
  const chunkedFace = all.has("ChunkedFace");
  const chunked = chunkedLine || chunkedFace;
  const chunkedHooks = chunked
    ? [
      ...(chunkedLine ? CHUNKED_LINE_HOOKS : []),
      ...(chunkedFace ? CHUNKED_FACE_HOOKS : []),
      ...TENSOR_SOURCE_HOOKS,
    ]
    : [];
  const workbenchNamespaceImport = chunked
    ? `\nimport * as Workbench from "@use-gpu/workbench";`
    : "";
  // gggplot-xc9: ChunkedLine's dash material authors WGSL at runtime via
  // @use-gpu/shader's `wgsl` tagged template and reuses view.wgsl's
  // getWorldScale (see render/chunked_line.tsx's header) -- only pulled in
  // when a ChunkedLine mark is actually present.
  const chunkedLineImport = chunkedLine
    ? `\nimport { wgsl } from "@use-gpu/shader/wgsl";\nimport { getWorldScale } from "@use-gpu/wgsl/use/view.wgsl";`
    : "";
  const chunkedDefs = chunked
    ? `\nconst { ${
      chunkedHooks.join(", ")
    } } = Workbench as unknown as Record<string, any>;\n${TENSOR_SOURCE_SOURCE}${SCALAR_COLOR_SOURCE}${
      chunkedLine ? CHUNKED_LINE_SOURCE : ""
    }${chunkedFace ? CHUNKED_FACE_SOURCE : ""}`
    : "";

  // Plain guide/annotation nodes still resolve to @use-gpu/plot components, but
  // those components carry FlatTensor 'positions'/'colors' props now (tzc.3) and
  // plot's own prop types predate that shape. Bind them through a loosely-typed
  // namespace destructure — exactly the `Partial<Record<ComponentName, any>>`
  // REGISTRY typing render/GGPlot.tsx dispatches through live — so the emitted
  // module type-checks while the runtime import stays @use-gpu/plot as before.
  const plotBindings = used.length
    ? `\nconst { ${
      used.join(", ")
    } } = PlotComponents as unknown as Record<string, any>;`
    : "";

  return `/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
import { ${liveImports} } from "@use-gpu/live";
import * as PlotComponents from "@use-gpu/plot";${workbenchImport}${interactImport}${workbenchNamespaceImport}${chunkedLineImport}${plotBindings}
${FONT_HOST_SOURCE}${facetPanelDef}${facetGridDef}${radialViewportDef}${panelViewportDef}${scene3dDef}${point3dDef}${guideLinesDef}${chunkedDefs}
// Generated by @gggplot/core. Do not edit by hand.
export const ${name} = ({ fontResources }: any = {}) => (
  <EmittedFontHost fontResources={fontResources}>
${emitNode(root, "    ")}
  </EmittedFontHost>
);
`;
}
