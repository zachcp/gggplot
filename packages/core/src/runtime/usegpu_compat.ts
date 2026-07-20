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
export type LiveComponent<P = Record<string, unknown>> = (props: P) => LiveElement;

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

export type UseMemo = <T>(create: () => T, dependencies: readonly unknown[]) => T;
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

const live = Live as unknown as {
  createElement: CreateElement;
  provide: Provide;
  useMemo: UseMemo;
  useOne: UseOne;
  useResource: UseResource;
  useAwait: UseAwait;
};

const workbench = Workbench as unknown as {
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
};

const plot = Plot as unknown as {
  Cartesian: LiveComponent;
  Grid: LiveComponent;
  Axis: LiveComponent;
  Face: LiveComponent;
};

// @use-gpu/live
export const createElement = live.createElement;
export const provide = live.provide;
export const useMemo = live.useMemo;
export const useOne = live.useOne;
export const useResource = live.useResource;
export const useAwait = live.useAwait;

// @use-gpu/workbench
export const RawData = workbench.RawData;
export const FaceLayer = workbench.FaceLayer;
export const useDeviceContext = workbench.useDeviceContext;
export const useSource = workbench.useSource;
export const useFaceSegmentsSource = workbench.useFaceSegmentsSource;
export const useNoFaceSegmentsSource = workbench.useNoFaceSegmentsSource;
export const useFaceSegmentsConcaveSource = workbench.useFaceSegmentsConcaveSource;
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
