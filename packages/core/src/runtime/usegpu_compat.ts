// Single typed compatibility surface for the @use-gpu/live, @use-gpu/workbench,
// and @use-gpu/plot exports the runtime and render layers depend on.
//
// Deno currently reads Workbench's (and Live's/Plot's) CommonJS type surface,
// while Vite resolves their documented ESM exports. Rather than have every
// runtime/*.tsx and render/*.tsx module re-derive its own `as unknown as`
// typed view of these namespaces, the casts are centralized here exactly once
// per namespace and each hook/component is re-exported with a narrow type. The
// production (Vite) build is the authoritative integration check for this shim.

import * as Live from "@use-gpu/live";
import * as Plot from "@use-gpu/plot";
import * as Workbench from "@use-gpu/workbench";
import type { LiveContext, LiveElement } from "@use-gpu/live";
import type { GPUStorageSource } from "./types.ts";

/** A layout rect in pixels: [left, top, right, bottom]. */
export type Rectangle = [number, number, number, number];

/** A UseGPU Live component: props in, LiveElement out. */
export type LiveComponent<P = Record<string, unknown>> = (
  props: P,
) => LiveElement;

/** Variadic Live element constructor (the `@jsx` factory). */
export type CreateElement = (
  type: unknown,
  props?: Record<string, unknown> | null,
  ...children: unknown[]
) => LiveElement;

export type Provide = (
  context: unknown,
  value: unknown,
  calls: LiveElement,
) => LiveElement;

export type UseMemo = <T>(
  create: () => T,
  dependencies: readonly unknown[],
) => T;
/** Emits a value to the nearest gathering ancestor (a compute or render pass). */
export type Yeet = (value: unknown) => LiveElement;
/** Creates a Live context; supplied with provide(), read with useContext(). */
export type MakeContext = <T>(initial: T, displayName?: string) => unknown;
/** Creates a Live capture; children report to it with useCapture(). */
export type MakeCapture = (displayName?: string) => unknown;
/**
 * Renders `calls` inline, then mounts `then(values)` after them with every
 * value its descendants reported through useCapture, in tree order.
 */
export type Capture = <T>(
  context: unknown,
  calls: unknown,
  then: (values: T[]) => LiveElement,
  key?: string,
) => LiveElement;
/** Reports a value to the nearest enclosing capture of `context`. */
export type UseCapture = (context: unknown, value: unknown) => void;
export type UseContext = <T>(context: unknown) => T;
export type UseOne = <T>(create: () => T, dependency?: unknown) => T;
export type UseState = <T>(
  initial: T | (() => T),
) => [T, (next: T | ((prev: T) => T)) => void];
export type UseResource = <T>(
  create: (dispose: (cleanup: () => void) => void) => T,
  dependencies: readonly unknown[],
) => T;
export type UseAwait = <T>(
  callback: ((cancelled: () => boolean) => Promise<T>) | null,
  dependencies: readonly unknown[],
) => [T | undefined, Error | undefined, boolean];

export type UseDeviceContext = () => GPUDevice;
export type UseSource = (definition: unknown, source: unknown) => unknown;

export interface FaceSegmentsSource {
  count: number;
  segments: unknown;
}
export type UseFaceSegmentsSource = (
  chunks: Uint32Array | readonly number[],
) => FaceSegmentsSource;
export type UseNoFaceSegmentsSource = () => void;
export type UseFaceSegmentsConcaveSource = (
  chunks: Uint32Array,
  groups: null,
  positions: Float32Array,
  dims: number,
) => { count: number; indexed: number; indices: unknown };
export type UseNoFaceSegmentsConcaveSource = () => void;

export type UseLineSegmentsSource = (
  args: { chunks: Uint32Array; groups: null; loops: boolean },
) => { count: number; segments: unknown };

export type UseRawTensorSource = (data: {
  array: Float32Array;
  format: string;
  size: number[];
  version: number;
}) => unknown;
export type UseNoRawTensorSource = () => void;
/**
 * Uploads `array` and returns its storage source. Re-uploads when the array's
 * identity or `version` changes.
 */
export type UseRawSource = (
  array: Float32Array | Uint32Array,
  format: string,
  options?: Record<string, unknown>,
  size?: number[],
  version?: number,
) => GPUStorageSource;
export type UseNoRawSource = () => void;

export type UseShader = (shader: unknown, values: unknown[]) => unknown;
export type UseShaderRef = (value: unknown) => unknown;
export interface MaterialContextValue {
  solid: Record<string, unknown>;
  [key: string]: unknown;
}
export type UseMaterialContext = () => MaterialContextValue;

/**
 * Picks the namespace that actually carries the API.
 *
 * Deno resolves these packages to their CommonJS build, where the exports sit
 * on `.default` and the namespace itself holds only `__esModule`/`default`;
 * Vite resolves the ESM build, where they are on the namespace directly. A
 * plain cast therefore yields `undefined` for every member under Deno, which
 * stays invisible until something actually calls one — so probe for a known
 * member rather than assuming either shape.
 *
 * The probe member must be one that only the FULL api carries. @use-gpu/live
 * also ships a default export that is just the JSX shim
 * ({createElement, Fragment, Yeet, ...}), so probing on `createElement` picks
 * that shim under Vite and loses every hook — which fails as a blank canvas,
 * not as a missing export. Probe on a hook instead.
 *
 * A probe found in NEITHER shape throws. Falling through to the bare namespace
 * would hand every caller `undefined` members under Deno, and nothing would
 * say why: that is what a probe on a symbol that moves package does (Use.GPU
 * 0.21 moved LayoutContext, QueueReconciler, LoopContext and RangeContext into
 * @use-gpu/frame, gggplot-hn39). Probe on a symbol the package owns.
 */
const interop = <T>(namespace: unknown, probe: string): T => {
  // deno-lint-ignore no-explicit-any
  const ns = namespace as any;
  if (ns?.default && ns.default[probe] !== undefined) return ns.default as T;
  if (ns?.[probe] !== undefined) return ns as T;
  throw new Error(
    `[gggplot] Use.GPU interop: probe "${probe}" is not exported by this ` +
      `package in either its CommonJS or ESM shape. It moved or was removed; ` +
      `probe on a symbol the package still owns.`,
  );
};

/**
 * A Use.GPU package namespace with its own types, its values taken from
 * whichever build the toolchain loaded (see interop). Destructure from it in
 * place of named imports: Deno cannot bind a named import to the CommonJS
 * build, so one named value import makes the whole module graph unloadable
 * under Deno (the CLI, and tests that import components).
 */
export const esm = <T>(namespace: T, probe: keyof T & string): T =>
  interop<T>(namespace, probe);

const live = interop<{
  createElement: CreateElement;
  Fragment: unknown;
  yeet: Yeet;
  provide: Provide;
  useMemo: UseMemo;
  useOne: UseOne;
  useState: UseState;
  useResource: UseResource;
  useAwait: UseAwait;
  makeContext: MakeContext;
  useContext: UseContext;
  makeCapture: MakeCapture;
  capture: Capture;
  useCapture: UseCapture;
  useFiberId: () => number;
}>(Live, "useMemo");

const workbench = interop<{
  Compute: LiveComponent;
  ComputeBuffer: LiveComponent;
  Stage: LiveComponent;
  Kernel: LiveComponent;
  Readback: LiveComponent;
  FaceLayer: LiveComponent;
  useDeviceContext: UseDeviceContext;
  useSource: UseSource;
  useFaceSegmentsSource: UseFaceSegmentsSource;
  useNoFaceSegmentsSource: UseNoFaceSegmentsSource;
  useFaceSegmentsConcaveSource: UseFaceSegmentsConcaveSource;
  useNoFaceSegmentsConcaveSource: UseNoFaceSegmentsConcaveSource;
  LineLayer: LiveComponent;
  useLineSegmentsSource: UseLineSegmentsSource;
  useRawTensorSource: UseRawTensorSource;
  useNoRawTensorSource: UseNoRawTensorSource;
  useRawSource: UseRawSource;
  useNoRawSource: UseNoRawSource;
  QueueReconciler: { signal: () => LiveElement };
  LoopContext: unknown;
  LayoutContext: LiveContext<Rectangle>;
  DeviceContext: unknown;
  PointLayer: LiveComponent;
  useLambdaSource: (shader: unknown, props: { length: number }) => unknown;
  useShader: UseShader;
  useShaderRef: UseShaderRef;
  useMaterialContext: UseMaterialContext;
  MaterialContext: unknown;
}>(Workbench, "useDeviceContext");

const plot = interop<{
  Cartesian: LiveComponent;
  Grid: LiveComponent;
  Axis: LiveComponent;
  Face: LiveComponent;
  RangeContext: LiveContext<[number, number][]>;
}>(Plot, "Cartesian");

// @use-gpu/live
export const createElement = live.createElement;
export const Fragment = live.Fragment;
export const yeet = live.yeet;
export const provide = live.provide;
export const useMemo = live.useMemo;
export const useOne = live.useOne;
export const useState = live.useState;
export const useResource = live.useResource;
export const useAwait = live.useAwait;
export const makeContext = live.makeContext;
export const useContext = live.useContext;
export const makeCapture = live.makeCapture;
export const capture = live.capture;
export const useCapture = live.useCapture;
export const useFiberId = live.useFiberId;

// @use-gpu/workbench
/**
 * `QueueReconciler.signal()` is an element that, when (re)rendered, tells the
 * frame queue to run again. <RawData> renders one whenever its source version
 * moves; a flat raw-source hook does not, so a component built on hooks must
 * render its own or compute that reads the new data never dispatches.
 */
export const QueueReconciler = workbench.QueueReconciler;
/**
 * SyncLoop's frame request, `(fiber?) => time`. Called with no fiber it just
 * enqueues one animation frame, and it is safe to call outside render. The
 * default (no SyncLoop above) is a no-op.
 */
export const LoopContext = workbench.LoopContext;
/**
 * The pixel rect [left, top, right, bottom] the enclosing view lays out into.
 * A context, so identity matters: it must be the very object the camera and
 * view components provide, never a second copy of its package.
 */
export const LayoutContext = workbench.LayoutContext;
/**
 * Gathers compute work from its children and mounts the passes that run it.
 *
 * Must be mounted OUTSIDE <Plot>: its Resume returns pass elements, and inside
 * <Plot> those land in VirtualLayers' layer tree and corrupt rendering. See
 * runtime/product_host.tsx.
 */
export const Compute = workbench.Compute;
/**
 * Read-write GPU storage for compute. Mountable anywhere with a device — it is
 * a buffer, not a pass — so a caller can create one outside <Compute> and hand
 * the target to a <Stage> inside it.
 *
 * Its width/height/depth DEFAULT TO THE RENDER CONTEXT (screen size), so a
 * data-shaped grid must always pass its own dimensions.
 */
export const ComputeBuffer = workbench.ComputeBuffer;
/** Sets the compute target(s) that <Kernel>s inside it write to. */
export const Stage = workbench.Stage;
/** Runs one linked compute shader against the enclosing <Stage>'s targets. */
export const Kernel = workbench.Kernel;
/**
 * Copies a storage source back to the CPU from inside the frame's compute pass.
 *
 * Mounts as a `post`/`readback` pair that only ReadbackPass gathers, so it must
 * sit inside <Compute> — which mounts ReadbackPass AFTER ComputePass, making
 * "the copy is enqueued behind this frame's compute" structural rather than
 * something a caller has to arrange. Its staging buffers are a rotating pool
 * allocated once, not one per call. See runtime/resident_readback.tsx.
 */
export const Readback = workbench.Readback;
export const FaceLayer = workbench.FaceLayer;
export const useDeviceContext = workbench.useDeviceContext;
export const useSource = workbench.useSource;
export const useFaceSegmentsSource = workbench.useFaceSegmentsSource;
export const useNoFaceSegmentsSource = workbench.useNoFaceSegmentsSource;
export const useFaceSegmentsConcaveSource =
  workbench.useFaceSegmentsConcaveSource;
export const useNoFaceSegmentsConcaveSource =
  workbench.useNoFaceSegmentsConcaveSource;
export const LineLayer = workbench.LineLayer;
export const useLineSegmentsSource = workbench.useLineSegmentsSource;
export const useRawTensorSource = workbench.useRawTensorSource;
export const useNoRawTensorSource = workbench.useNoRawTensorSource;
export const useRawSource = workbench.useRawSource;
export const useNoRawSource = workbench.useNoRawSource;
/** The mounted GPUDevice; provided by <WebGPU>, or directly in headless tests. */
export const DeviceContext = workbench.DeviceContext;
/** Workbench's point layer: takes shader-bound colors/sizes, unlike plot's <Point>. */
export const PointLayer = workbench.PointLayer;
/** Wraps a bound shader function as a source of `length` elements. */
export const useLambdaSource = workbench.useLambdaSource;
export const useShader = workbench.useShader;
export const useShaderRef = workbench.useShaderRef;
export const useMaterialContext = workbench.useMaterialContext;
export const MaterialContext = workbench.MaterialContext;

// @use-gpu/plot
export const Cartesian = plot.Cartesian;
export const Grid = plot.Grid;
export const Axis = plot.Axis;
export const Face = plot.Face;
/** The data range each plot shape and guide reads; Cartesian provides it. */
export const RangeContext = plot.RangeContext;
