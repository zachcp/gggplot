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
import type { LiveElement } from "@use-gpu/live";
import type { GPUStorageSource } from "./types.ts";

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
export type UseContext = <T>(context: unknown) => T;
export type UseOne = <T>(create: () => T, dependency?: unknown) => T;
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

export type UseShader = (shader: unknown, values: unknown[]) => unknown;
export type UseShaderRef = (value: unknown) => unknown;
export interface MaterialContextValue {
  solid: Record<string, unknown>;
  [key: string]: unknown;
}
export type UseMaterialContext = () => MaterialContextValue;

/** RawData mounts a typed column and yields its GPU storage source. */
export type RawDataComponent = LiveComponent<{
  data: Float32Array | Uint32Array;
  format: "f32" | "u32";
  children: (source: GPUStorageSource) => LiveElement;
}>;

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
 */
const interop = <T>(namespace: unknown, probe: string): T => {
  // deno-lint-ignore no-explicit-any
  const ns = namespace as any;
  return (ns?.default && ns.default[probe] ? ns.default : ns) as T;
};

const live = interop<{
  createElement: CreateElement;
  Fragment: unknown;
  yeet: Yeet;
  provide: Provide;
  useMemo: UseMemo;
  useOne: UseOne;
  useResource: UseResource;
  useAwait: UseAwait;
  makeContext: MakeContext;
  useContext: UseContext;
}>(Live, "useMemo");

const workbench = interop<{
  Compute: LiveComponent;
  ComputeBuffer: LiveComponent;
  Stage: LiveComponent;
  Kernel: LiveComponent;
  Readback: LiveComponent;
  RawData: RawDataComponent;
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
}>(Plot, "Cartesian");

// @use-gpu/live
export const createElement = live.createElement;
export const Fragment = live.Fragment;
export const yeet = live.yeet;
export const provide = live.provide;
export const useMemo = live.useMemo;
export const useOne = live.useOne;
export const useResource = live.useResource;
export const useAwait = live.useAwait;
export const makeContext = live.makeContext;
export const useContext = live.useContext;

// @use-gpu/workbench
/**
 * Gathers compute work from its children and mounts the passes that run it.
 *
 * Must be mounted OUTSIDE <Plot>: its Resume returns pass elements, and inside
 * <Plot> those land in VirtualLayers' layer tree and corrupt rendering. See
 * runtime/resident_host.tsx.
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
export const RawData = workbench.RawData;
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
export const useShader = workbench.useShader;
export const useShaderRef = workbench.useShaderRef;
export const useMaterialContext = workbench.useMaterialContext;
export const MaterialContext = workbench.MaterialContext;

// @use-gpu/plot
export const Cartesian = plot.Cartesian;
export const Grid = plot.Grid;
export const Axis = plot.Axis;
export const Face = plot.Face;
