// @experimental Contract landed ahead of use (gggplot-btd): the streaming
// source adapter has no consumer outside tests/runtime_test.ts. It is the
// planned realization of the GPU-native "streaming is a distinct
// SourceAdapter, not useRawSource" rule (docs/ARCHITECTURE.md §4); the
// static-data render path uses
// GPUDataProvider/RawData instead. Wire it to a demo/host consumer or delete
// it when streaming data is scheduled — do not grow a third mechanism.
import type { Column } from "../data/mod.ts";
import type { FieldSpec } from "../plan/mod.ts";
import { rawArrayForColumn } from "./raw.ts";
import type { GPUStorageSource } from "./types.ts";

const USAGE = 0x0080 | 0x0008 | 0x0004;

/** A logical element range in a streaming field update. */
export interface StreamingRange {
  readonly start: number;
  readonly length: number;
}

/** GPU source contract with allocation capacity in addition to logical length. */
export interface StreamingGPUStorageSource extends GPUStorageSource {
  readonly capacity: number;
}

interface Entry {
  field: FieldSpec;
  data: Float32Array | Uint32Array;
  buffer?: GPUBuffer;
  capacity: number;
  length: number;
  version: number;
}

function capacityFor(length: number): number {
  let capacity = 1;
  while (capacity < length) capacity *= 2;
  return capacity;
}

function validate(field: FieldSpec, column: Column): void {
  const expected = column.type === "numeric" ? "f32" : "u32";
  if (field.dtype !== expected) {
    throw new Error(
      `Cannot stream ${field.name}: ${field.dtype} does not match ${column.type} column`,
    );
  }
}

function validateRange(range: StreamingRange, length: number): void {
  if (
    !Number.isInteger(range.start) || !Number.isInteger(range.length) ||
    range.start < 0 || range.length < 0 || range.start + range.length > length
  ) {
    throw new RangeError(
      "Streaming update range lies outside the logical source length",
    );
  }
}

/**
 * Range-write adapter for append/subrange sources. It intentionally does not
 * use RawData/useRawSource: those declarations represent static whole-column
 * sources, while this adapter owns a persistent mutable storage buffer.
 */
export class GPUStreamingSourceAdapter {
  #entries = new Map<string, Entry>();

  constructor(private readonly device: GPUDevice) {}

  /**
   * Applies a full snapshot with an explicit changed range. A compatible
   * buffer writes only that range; growth reallocates and uploads the complete
   * logical snapshot exactly once.
   */
  update(
    field: FieldSpec,
    column: Column,
    range: StreamingRange = {
      start: 0,
      length: rawArrayForColumn(column).length,
    },
  ): StreamingGPUStorageSource {
    validate(field, column);
    const next = rawArrayForColumn(column);
    validateRange(range, next.length);
    let entry = this.#entries.get(field.name);
    if (!entry) {
      entry = {
        field,
        data: next.slice(),
        capacity: 0,
        length: next.length,
        version: 0,
      };
      this.#entries.set(field.name, entry);
      return this.allocateAndUpload(entry);
    }
    if (entry.field.dtype !== field.dtype) {
      throw new Error(`Cannot stream ${field.name}: field dtype changed`);
    }
    entry.field = field;
    entry.length = next.length;
    if (next.length > entry.capacity || !entry.buffer) {
      entry.data = next.slice();
      return this.allocateAndUpload(entry);
    }
    entry.data.set(
      next.subarray(range.start, range.start + range.length),
      range.start,
    );
    const bytes = entry.data.BYTES_PER_ELEMENT;
    if (range.length) {
      this.device.queue.writeBuffer(
        entry.buffer,
        range.start * bytes,
        entry.data.subarray(range.start, range.start + range.length),
      );
    }
    entry.version++;
    return this.source(entry);
  }

  /** Drops device objects but keeps CPU snapshots for explicit rehydration. */
  deviceLost(): void {
    for (const entry of this.#entries.values()) {
      entry.buffer?.destroy();
      entry.buffer = undefined;
    }
  }

  /** Recreates a source from its retained logical snapshot after device loss. */
  rehydrate(name: string): StreamingGPUStorageSource {
    const entry = this.#entries.get(name);
    if (!entry) throw new Error(`No streaming source named ${name}`);
    if (!entry.buffer) return this.allocateAndUpload(entry);
    return this.source(entry);
  }

  destroy(): void {
    for (const entry of this.#entries.values()) entry.buffer?.destroy();
    this.#entries.clear();
  }

  private allocateAndUpload(entry: Entry): StreamingGPUStorageSource {
    entry.buffer?.destroy();
    entry.capacity = capacityFor(entry.length);
    const storage = entry.data instanceof Float32Array
      ? new Float32Array(entry.capacity)
      : new Uint32Array(entry.capacity);
    storage.set(entry.data.subarray(0, entry.length));
    entry.data = storage;
    entry.buffer = this.device.createBuffer({
      size: Math.max(4, entry.capacity * entry.data.BYTES_PER_ELEMENT),
      usage: USAGE,
    });
    if (entry.length) {
      this.device.queue.writeBuffer(
        entry.buffer,
        0,
        entry.data.subarray(0, entry.length),
      );
    }
    entry.version++;
    return this.source(entry);
  }

  private source(entry: Entry): StreamingGPUStorageSource {
    if (!entry.buffer) throw new Error("Streaming source has no GPU buffer");
    return {
      id: `stream:${entry.field.name}`,
      buffer: entry.buffer,
      format: entry.field.dtype,
      length: entry.length,
      size: [entry.length],
      version: entry.version,
      addressSpace: "storage",
      capacity: entry.capacity,
    };
  }
}
