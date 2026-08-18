import type { ModelDocument, ModelDType, RuntimeArtifact } from "./types.ts";
import type { TensorSource } from "./residency.ts";

export type ModelRuntimeName =
  | "transformers-js"
  | "onnxruntime-web"
  | "fixture"
  | "other";

export interface ModelRuntimeCapabilities {
  runtime: ModelRuntimeName;
  execution: "wasm" | "webgpu" | "webnn" | "unknown";
  graphMetadata: "none" | "partial" | "full";
  intermediateOutputs: "none" | "selected" | "all";
  gpuTensorInterop: "none" | "copy" | "shared";
  externalData: boolean;
  quantizedDtypes: string[];
}

export type TensorOwnership =
  | "visualizer-owned"
  | "runtime-shared"
  | "runtime-copy-on-demand";

/** Runtime-only GPU tensor information; never serialized into ModelDocument. */
export interface RuntimeGpuTensorBinding {
  deviceToken: object;
  resource: unknown;
  sourceId: string;
  byteOffset: number;
  byteLength: number;
  dtype: ModelDType;
  shape: number[];
  strides?: number[];
  usage: "read-only" | "read-write";
}

export interface RuntimeTensorOutput {
  artifact: RuntimeArtifact;
  source?: TensorSource;
  gpu?: RuntimeGpuTensorBinding;
}

export interface RuntimeOutputRequest {
  nodeId?: string;
  tensorId?: string;
  artifactId: string;
  maxBytes?: number;
  ownership?: TensorOwnership;
}

export interface ModelRuntimeAdapter {
  readonly name: ModelRuntimeName;
  readonly capabilities: ModelRuntimeCapabilities;
  inspect(): Promise<ModelDocument>;
  capture?(request: RuntimeOutputRequest): Promise<RuntimeTensorOutput>;
}

export interface SharedTensorRequirements {
  deviceToken: object;
  sourceId: string;
  byteOffset: number;
  byteLength: number;
  dtype: ModelDType;
  shape: number[];
  strides?: number[];
}

/** Explain why a runtime tensor can or cannot be consumed without copying. */
export function sharedTensorCompatibility(
  binding: RuntimeGpuTensorBinding | undefined,
  requirements: SharedTensorRequirements,
): { compatible: true } | { compatible: false; reason: string } {
  if (!binding) {
    return {
      compatible: false,
      reason: "runtime did not provide a GPU tensor",
    };
  }
  if (binding.deviceToken !== requirements.deviceToken) {
    return {
      compatible: false,
      reason: "runtime and visualizer use different devices",
    };
  }
  if (binding.sourceId !== requirements.sourceId) {
    return { compatible: false, reason: "source identity differs" };
  }
  if (
    binding.byteOffset !== requirements.byteOffset ||
    binding.byteLength !== requirements.byteLength
  ) {
    return { compatible: false, reason: "byte range differs" };
  }
  if (binding.dtype !== requirements.dtype) {
    return { compatible: false, reason: "dtype differs" };
  }
  if (binding.usage !== "read-only") {
    return { compatible: false, reason: "runtime tensor is not read-only" };
  }
  if (
    binding.shape.length !== requirements.shape.length ||
    binding.shape.some((value, i) => value !== requirements.shape[i])
  ) {
    return { compatible: false, reason: "shape differs" };
  }
  const bindingStrides = binding.strides ?? [];
  const requirementStrides = requirements.strides ?? [];
  if (
    bindingStrides.length !== requirementStrides.length ||
    bindingStrides.some((value, i) => value !== requirementStrides[i])
  ) {
    return { compatible: false, reason: "strides differ" };
  }
  return { compatible: true };
}

export function chooseTensorOwnership(
  capabilities: ModelRuntimeCapabilities,
  binding: RuntimeGpuTensorBinding | undefined,
  requirements: SharedTensorRequirements,
  preferred: TensorOwnership = "visualizer-owned",
): TensorOwnership {
  if (preferred === "visualizer-owned") return "visualizer-owned";
  const compatible = sharedTensorCompatibility(binding, requirements);
  if (
    preferred === "runtime-shared" &&
    capabilities.gpuTensorInterop === "shared" && compatible.compatible
  ) {
    return "runtime-shared";
  }
  return "runtime-copy-on-demand";
}

export const TRANSFORMERS_JS_WEBGPU_CAPABILITIES: ModelRuntimeCapabilities = {
  runtime: "transformers-js",
  execution: "webgpu",
  graphMetadata: "partial",
  intermediateOutputs: "selected",
  gpuTensorInterop: "copy",
  externalData: true,
  quantizedDtypes: ["q4", "q8", "int8", "uint8"],
};

export const ONNXRUNTIME_WEBGPU_CAPABILITIES: ModelRuntimeCapabilities = {
  runtime: "onnxruntime-web",
  execution: "webgpu",
  graphMetadata: "full",
  intermediateOutputs: "selected",
  gpuTensorInterop: "shared",
  externalData: true,
  quantizedDtypes: ["int8", "uint8", "int4"],
};
