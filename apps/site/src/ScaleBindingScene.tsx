/** @jsxRuntime classic */
/** @jsx createElement */
// vnh.16: real draw calls consume linked functions; the compute is test-only.
import * as WB from "@use-gpu/workbench";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import type { LiveElement } from "@use-gpu/live";
import {
  Compute,
  ComputeBuffer,
  createElement,
  FaceLayer,
  Fragment,
  Kernel,
  LineLayer,
  makeContext,
  provide,
  Readback,
  Stage,
  useContext,
  useDeviceContext,
  useFaceSegmentsSource,
  useMemo,
  useNoFaceSegmentsSource,
  useNoRawTensorSource,
  useOne,
  useRawTensorSource,
  useShader,
} from "../../../packages/core/src/runtime/usegpu_compat.ts";
import {
  getGpuMarkCounters,
  installGpuInstrumentation,
  resetGpuMarkCounters,
  withMarkAttribution,
} from "../../../packages/core/src/render/gpu_instrument.ts";
import {
  ALPHA_BINDING,
  AUDIT_KERNEL,
  CASES,
  COLOR_BINDING,
  cpuAudit,
  FIXED_BINDING,
  scaleParameters,
  SIZE_BINDING,
  type SpikeScales,
  updateParameters,
  VALUES,
} from "../../../packages/core/spikes/gpu_scale_binding.ts";
import { parseColorRGBA } from "../../../packages/core/src/color/mod.ts";

// Same CJS/ESM normalization as the production compatibility surface.
const ns = WB as unknown as {
  default?: Record<string, unknown>;
  useDeviceContext?: unknown;
};
const wb = (ns.default?.useDeviceContext ? ns.default : ns) as unknown as {
  PointLayer: unknown;
  FlatCamera: unknown;
  Pass: unknown;
  useLambdaSource: (shader: unknown, props: unknown) => unknown;
};
const GuideContext = makeContext<
  { revision: number; scales: SpikeScales } | null
>(null, "ScaleBindingGuide");

export const scaleProbe = {
  revision: 0,
  guideRevision: 0,
  guideRenders: 0,
  mounts: 0,
  bundleBuilds: 0,
  pipelineBuilds: 0,
  shaderModuleBuilds: 0,
  results: {} as Record<
    string,
    { revision: number; maxError: number; values: number[] }
  >,
  getCounters: getGpuMarkCounters,
  reset: resetGpuMarkCounters,
};

function raw(
  array: Float32Array | Uint32Array,
  format: string,
  length: number,
  mark = true,
): unknown {
  const upload = useRawTensorSource as (data: unknown) => unknown;
  const run = () => upload({ array, format, size: [length], version: 1 });
  return mark ? withMarkAttribution(run) : run();
}

function Guide(): LiveElement {
  const guide = useContext<{ revision: number; scales: SpikeScales }>(
    GuideContext,
  );
  scaleProbe.guideRevision = guide.revision;
  scaleProbe.guideRenders++;
  return null as unknown as LiveElement;
}

function Marks({ fixture, refs, palette, revision, scales, cpu }: {
  fixture: typeof CASES[number];
  refs: ReturnType<typeof scaleParameters>;
  palette: Float32Array;
  revision: number;
  scales: SpikeScales;
  cpu: boolean;
}): LiveElement {
  const n = fixture.owners.length;
  useOne(() => {
    scaleProbe.mounts++;
    return true;
  });
  const values = raw(VALUES, "f32", VALUES.length);
  const owners = raw(fixture.owners, "u32", n);
  const positions = raw(fixture.positions, "vec2<f32>", n);
  const paletteSource = raw(palette, "vec4<f32>", palette.length / 4, false);
  const paletteLength = useOne(() => ({ current: palette.length / 4 }));
  const alpha = useShader(ALPHA_BINDING, [
    values,
    owners,
    refs.alphaDomain,
    refs.alphaRange,
  ]);
  const color = useShader(COLOR_BINDING, [
    values,
    owners,
    refs.colorDomain,
    paletteSource,
    paletteLength,
    alpha,
  ]);
  const radius = useShader(SIZE_BINDING, [
    values,
    owners,
    refs.sizeDomain,
    refs.sizeRange,
  ]);
  const fixed = useShader(FIXED_BINDING, [refs.fixed]);
  const auditSources = useMemo(() => [color, radius, alpha, fixed], [
    color,
    radius,
    alpha,
    fixed,
  ]);
  useMemo(() => {
    scaleProbe.bundleBuilds += 4;
    return true;
  }, [alpha, color, radius, fixed]);
  const props = useOne(() => ({ length: n }));
  const colorSource = wb.useLambdaSource(color, props);
  const radiusSource = wb.useLambdaSource(radius, props);
  const fixedSource = wb.useLambdaSource(fixed, props);
  // Reference arrays are diagnostic only and never uploaded in the GPU mode.
  const reference = useMemo(() => cpuAudit(scales, fixture.owners, revision), [
    scales,
    revision,
  ]);
  const cpuColors = useMemo(
    () =>
      Float32Array.from(
        [...fixture.owners].flatMap((
          _,
          i,
        ) => [...reference.slice(i * 12, i * 12 + 4)]),
      ),
    [reference],
  );
  const cpuSizes = useMemo(
    () =>
      Float32Array.from(
        [...fixture.owners].map((_, i) => reference[i * 12 + 4]),
      ),
    [reference],
  );
  const colors = cpu
    ? raw(cpuColors, "vec4<f32>", n)
    : (useNoRawTensorSource(), undefined);
  const sizes = cpu
    ? raw(cpuSizes, "f32", n)
    : (useNoRawTensorSource(), undefined);
  const chunks = useOne(() =>
    Uint32Array.of(...Array(fixture.kind === "bars" ? n / 4 : 1).fill(4))
  );
  const fan = fixture.kind === "bars"
    ? useFaceSegmentsSource(chunks)
    : (useNoFaceSegmentsSource(), undefined);
  const segments = useOne(() => Uint32Array.of(n));
  // Only bars use fan indices, line uses its own line segments hook below.
  const mark = fixture.kind === "points"
    ? createElement(wb.PointLayer, {
      positions,
      colors: cpu ? colors : colorSource,
      sizes: cpu ? sizes : radiusSource,
      count: n,
      hard: true,
      mode: "transparent",
    })
    : fixture.kind === "line"
    ? createElement(StepLine, {
      positions,
      colors: cpu ? colors : colorSource,
      n,
      segments,
    })
    : createElement(FaceLayer, {
      positions,
      colors: cpu ? colors : colorSource,
      segments: fan!.segments,
      count: fan!.count,
      side: "both",
      mode: "transparent",
    });
  const audit = createElement(ComputeBuffer, {
    width: n * 3,
    height: 1,
    depth: 1,
    format: "vec4<f32>",
    label: `scale-audit-${fixture.name}`,
    children: (target: unknown) =>
      createElement(
        Compute,
        {},
        createElement(
          Stage,
          { target },
          createElement(Kernel, {
            shader: AUDIT_KERNEL,
            args: [revision],
            sources: auditSources,
            size: AUDIT_SIZES[fixture.name],
            version: revision,
            initial: true,
          }),
        ),
        createElement(Readback, {
          source: target,
          shouldDispatch: () =>
            scaleProbe.results[fixture.name]?.revision !== revision,
          then: (data: Float32Array) => {
            // The generation is WRITTEN by the audit kernel, not by a clear pass.
            if (
              [...fixture.owners].some((_, i) => data[i * 12 + 6] !== revision)
            ) return null;
            const got = data.slice(0, n * 12);
            const maxError = Math.max(
              ...got.map((value, i) => Math.abs(value - reference[i])),
            );
            scaleProbe.results[fixture.name] = {
              revision,
              maxError,
              values: [...got],
            };
            return null;
          },
        }),
      ),
  });
  return createElement(
    Fragment,
    {},
    audit,
    mark,
    fixture.kind === "points"
      ? createElement(wb.PointLayer, {
        position: [370, 60, 0, 1],
        colors: fixedSource,
        size: 24,
        count: 1,
        hard: true,
      })
      : null,
  );
}

const AUDIT_SIZES = Object.fromEntries(
  CASES.map((f) => [f.name, [f.owners.length, 1]]),
);
const lineHooks =
  (ns.default?.useDeviceContext ? ns.default : ns) as unknown as {
    useLineSegmentsSource: (
      value: unknown,
    ) => { count: number; segments: unknown };
  };
function StepLine(
  { positions, colors, segments }: {
    positions: unknown;
    colors: unknown;
    n: number;
    segments: Uint32Array;
  },
): LiveElement {
  const topology = lineHooks.useLineSegmentsSource({
    chunks: segments,
    groups: null,
    loops: false,
  });
  return createElement(LineLayer, {
    positions,
    colors,
    count: topology.count,
    segments: topology.segments,
    width: 8,
    mode: "transparent",
  });
}

function Graph(
  { scales, revision, cpu }: {
    scales: SpikeScales;
    revision: number;
    cpu: boolean;
  },
): LiveElement {
  const device = useDeviceContext();
  useOne(() => {
    installGpuInstrumentation(device);
    const module = device.createShaderModule.bind(device);
    device.createShaderModule = (descriptor) => {
      scaleProbe.shaderModuleBuilds++;
      return module(descriptor);
    };
    const compute = device.createComputePipelineAsync.bind(device);
    device.createComputePipelineAsync = (descriptor) => {
      scaleProbe.pipelineBuilds++;
      return compute(descriptor);
    };
    const render = device.createRenderPipelineAsync.bind(device);
    device.createRenderPipelineAsync = (descriptor) => {
      scaleProbe.pipelineBuilds++;
      return render(descriptor);
    };
    return true;
  });
  const refs = useOne(() => scaleParameters(scales));
  useMemo(() => {
    updateParameters(refs, scales);
    scaleProbe.revision = revision;
    return true;
  }, [scales, revision]);
  // Palette replacement is outside this spike: only the domain and fixed
  // color change. A production adapter must update this small source separately.
  const palette = useOne(() =>
    Float32Array.from(
      (scales.color.range as string[]).flatMap((c) => parseColorRGBA(c)),
    )
  );
  // Stable GPU refs and an immutable CPU revision are separate contracts.
  const guide = useMemo(() => ({ scales, revision }), [scales, revision]);
  return provide(
    GuideContext,
    guide,
    createElement(
      Fragment,
      {},
      createElement(Guide),
      ...CASES.map((fixture) =>
        createElement(Marks, {
          key: fixture.name,
          fixture,
          refs,
          palette,
          scales,
          revision,
          cpu,
        })
      ),
    ),
  );
}

export function ScaleBindingScene(
  { canvas, scales, revision, cpu }: {
    canvas: HTMLCanvasElement;
    scales: SpikeScales;
    revision: number;
    cpu: boolean;
  },
): LiveElement {
  return createElement(
    WebGPU,
    { fallback: null },
    createElement(
      AutoCanvas,
      { canvas, backgroundColor: [1, 1, 1, 1] },
      createElement(
        wb.FlatCamera,
        {},
        createElement(
          wb.Pass,
          {},
          createElement(Graph, { scales, revision, cpu }),
        ),
      ),
    ),
  );
}
