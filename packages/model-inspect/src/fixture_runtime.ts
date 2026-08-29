import type { ModelDocument, ModelDType, RuntimeArtifact } from "./types.ts";
import { ByteArrayTensorSource, type TensorSource } from "./residency.ts";
import {
  chooseTensorOwnership,
  type ModelRuntimeAdapter,
  type ModelRuntimeCapabilities,
  type RuntimeGpuTensorBinding,
  type RuntimeOutputRequest,
  type RuntimeTensorOutput,
  type TensorOwnership,
} from "./runtime.ts";

/**
 * A runtime that produces pre-recorded outputs.
 *
 * The adapter contract is the package's boundary against inference runtimes,
 * but every real implementation of it needs a browser, a WebGPU device, and a
 * multi-megabyte WASM payload, so the `capture` half went unexercised. This
 * fixture closes that: it runs anywhere Deno or Node does, executes no model
 * code, and drives the same ownership negotiation and bounded-range rules a
 * real runtime must obey. Use it to test consumers of the contract, and as the
 * reference for what an adapter is required to enforce.
 */
export const FIXTURE_CAPABILITIES: ModelRuntimeCapabilities = {
  runtime: "fixture",
  execution: "unknown",
  graphMetadata: "full",
  intermediateOutputs: "selected",
  gpuTensorInterop: "none",
  externalData: false,
  quantizedDtypes: [],
};

/** One pre-recorded runtime output, addressed by artifact id. */
export interface FixtureCapture {
  artifact: RuntimeArtifact;
  bytes: Uint8Array;
  dtype: ModelDType;
  shape: number[];
  /**
   * Optional runtime-owned GPU binding. Supplying one lets a test exercise the
   * shared path; omitting it is the honest default, since a fixture owns no
   * device.
   */
  gpu?: RuntimeGpuTensorBinding;
}

export interface FixtureRuntimeOptions {
  document: ModelDocument;
  captures?: FixtureCapture[];
  capabilities?: Partial<ModelRuntimeCapabilities>;
  /** Ownership the host prefers; the adapter still validates before granting. */
  preferredOwnership?: TensorOwnership;
}

export class FixtureCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FixtureCaptureError";
  }
}

/** The ownership actually granted for a capture, beside its payload. */
export interface FixtureRuntimeTensorOutput extends RuntimeTensorOutput {
  ownership: TensorOwnership;
  source: TensorSource;
}

/** A fixture always reports its granted ownership and a readable source. */
export interface FixtureRuntimeAdapter extends ModelRuntimeAdapter {
  capture(request: RuntimeOutputRequest): Promise<FixtureRuntimeTensorOutput>;
}

export function fixtureRuntimeAdapter(
  options: FixtureRuntimeOptions,
): FixtureRuntimeAdapter {
  const capabilities: ModelRuntimeCapabilities = {
    ...FIXTURE_CAPABILITIES,
    ...options.capabilities,
  };
  const captures = new Map(
    (options.captures ?? []).map((capture) => [capture.artifact.id, capture]),
  );

  // Conforms to the async runtime capture contract; the fixture backend
  // resolves from memory.
  // deno-lint-ignore require-await
  const capture = async (
    request: RuntimeOutputRequest,
  ): Promise<FixtureRuntimeTensorOutput> => {
    const found = captures.get(request.artifactId);
    if (!found) {
      throw new FixtureCaptureError(
        `no recorded capture for artifact ${request.artifactId}`,
      );
    }
    // A runtime may only answer the question it was asked. Silently returning
    // a different node's tensor would corrupt the stable-ID linkage every
    // product relies on to cross-link views.
    if (request.nodeId && found.artifact.nodeId !== request.nodeId) {
      throw new FixtureCaptureError(
        `artifact ${request.artifactId} does not belong to node ${request.nodeId}`,
      );
    }
    if (request.tensorId && found.artifact.tensorId !== request.tensorId) {
      throw new FixtureCaptureError(
        `artifact ${request.artifactId} does not belong to tensor ${request.tensorId}`,
      );
    }
    // Budgets bound the capture rather than truncating it: a short read would
    // present partial data as if it were the whole tensor.
    if (
      request.maxBytes !== undefined &&
      found.bytes.byteLength > request.maxBytes
    ) {
      throw new FixtureCaptureError(
        `artifact ${request.artifactId} is ${found.bytes.byteLength} bytes, ` +
          `over the ${request.maxBytes} byte budget`,
      );
    }

    const sourceId = found.artifact.sourceId ?? found.artifact.id;
    const ownership = chooseTensorOwnership(
      capabilities,
      found.gpu,
      {
        deviceToken: found.gpu?.deviceToken ?? {},
        sourceId,
        byteOffset: found.gpu?.byteOffset ?? 0,
        byteLength: found.bytes.byteLength,
        dtype: found.dtype,
        shape: found.shape,
        strides: found.gpu?.strides,
      },
      request.ownership ?? options.preferredOwnership ?? "visualizer-owned",
    );

    return {
      artifact: found.artifact,
      ownership,
      source: new ByteArrayTensorSource(sourceId, "fixture@1", found.bytes),
      ...(found.gpu ? { gpu: found.gpu } : {}),
    };
  };

  return {
    name: "fixture",
    capabilities,
    inspect: () => Promise.resolve(options.document),
    capture,
  };
}
