import type {
  GroupedHistogram1DInput,
  GroupedHistogram2DInput,
  WgpuKernelPlan,
} from "./types.ts";

export const CLEAR_U32_WGSL = `
@group(0) @binding(0) var<storage, read_write> values: array<u32>;
@group(0) @binding(1) var<uniform> len: u32;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= len) {
    return;
  }
  values[i] = 0u;
}
`.trim();

/** Initializes the ordered-float [minimum, maximum] domain accumulator. */
export const DOMAIN_CLEAR_WGSL = `
@group(0) @binding(0) var<storage, read_write> domain: array<atomic<u32>>;

@compute @workgroup_size(1)
fn main() {
  atomicStore(&domain[0], 0xffffffffu);
  atomicStore(&domain[1], 0u);
}
`.trim();

/** Reduces finite f32 values to an ordered-bit [minimum, maximum] pair. */
export const FINITE_DOMAIN_1D_WGSL = `
@group(0) @binding(0) var<storage, read> values: array<f32>;
@group(0) @binding(1) var<storage, read_write> domain: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> rows: u32;

fn orderedBits(value: f32) -> u32 {
  let bits = bitcast<u32>(value);
  return select(~bits, bits ^ 0x80000000u, (bits & 0x80000000u) == 0u);
}

fn isFiniteValue(value: f32) -> bool {
  // 3.4028235e38 rounds beyond the largest representable f32 in WGSL and
  // invalidates the complete compute pipeline in Dawn. Keep this literal
  // strictly inside the f32 range so the finite-domain reduction can compile.
  return value == value && abs(value) <= 3.4e38;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  if (row >= rows) {
    return;
  }
  let value = values[row];
  if (!isFiniteValue(value)) {
    return;
  }
  let ordered = orderedBits(value);
  atomicMin(&domain[0], ordered);
  atomicMax(&domain[1], ordered);
}
`.trim();

export const GROUPED_HISTOGRAM_1D_WGSL = `
struct HistogramParams {
  rows: u32,
  bins: u32,
  groups: u32,
  hasGroups: u32,
  lo: f32,
  binwidth: f32,
  position: u32,
};

@group(0) @binding(0) var<storage, read> values: array<f32>;
@group(0) @binding(1) var<storage, read> groupIds: array<u32>;
@group(0) @binding(2) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: HistogramParams;

fn isFiniteValue(value: f32) -> bool {
  return value == value && abs(value) <= 3.4e38;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  if (row >= params.rows || params.bins == 0u || params.groups == 0u) {
    return;
  }

  let value = values[row];
  if (!isFiniteValue(value)) {
    return;
  }
  let rawBin = i32(floor((value - params.lo) / params.binwidth));
  let clamped = clamp(rawBin, 0, i32(params.bins) - 1);
  let bin = u32(clamped);
  let group = select(0u, groupIds[row], params.hasGroups != 0u);

  if (group >= params.groups) {
    return;
  }

  let offset = group * params.bins + bin;
  atomicAdd(&counts[offset], 1u);
}
`.trim();

export const GROUPED_COUNT_1D_WGSL = `
struct CountParams {
  rows: u32,
  values: u32,
  groups: u32,
  hasGroups: u32,
};

@group(0) @binding(0) var<storage, read> valueIds: array<u32>;
@group(0) @binding(1) var<storage, read> groupIds: array<u32>;
@group(0) @binding(2) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: CountParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  if (row >= params.rows || params.values == 0u || params.groups == 0u) {
    return;
  }
  let value = valueIds[row];
  let group = select(0u, groupIds[row], params.hasGroups != 0u);
  if (value >= params.values || group >= params.groups) {
    return;
  }
  atomicAdd(&counts[group * params.values + value], 1u);
}
`.trim();

/** Expands a [group, category] count grid into 0.9-wide categorical bars. */
export const COUNT_BAR_VERTICES_WGSL = `
struct CountParams {
  rows: u32,
  values: u32,
  groups: u32,
  hasGroups: u32,
  unusedLo: f32,
  unusedWidth: f32,
  position: u32,
};
@group(0) @binding(0) var<storage, read> counts: array<u32>;
@group(0) @binding(1) var<storage, read_write> vertices: array<vec2<f32>>;
@group(0) @binding(2) var<uniform> params: CountParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell = global_id.x;
  if (cell >= params.groups * params.values || params.values == 0u) { return; }
  let group = cell / params.values;
  let value = cell % params.values;
  let count = counts[cell];
  var lower = 0u;
  var upper = count;
  if (params.position == 1u || params.position == 3u) {
    for (var prior = 0u; prior < group; prior = prior + 1u) {
      lower = lower + counts[prior * params.values + value];
    }
    upper = lower + count;
  }
  var width = 0.9;
  var left = f32(value) - width * 0.5;
  if (params.position == 2u) {
    width = width / f32(params.groups);
    left = f32(value) - 0.45 + f32(group) * width;
  }
  var y0 = f32(lower);
  var y1 = f32(upper);
  if (params.position == 3u) {
    var total = 0u;
    for (var index = 0u; index < params.groups; index = index + 1u) {
      total = total + counts[index * params.values + value];
    }
    y0 = select(0.0, f32(lower) / f32(total), total > 0u);
    y1 = select(0.0, f32(upper) / f32(total), total > 0u);
  }
  let offset = cell * 4u;
  vertices[offset] = vec2<f32>(left, y0);
  vertices[offset + 1u] = vec2<f32>(left, y1);
  vertices[offset + 2u] = vec2<f32>(left + width, y1);
  vertices[offset + 3u] = vec2<f32>(left + width, y0);
}
`.trim();

/**
 * Expands the resident [group, bin] count grid into four XY vertices per bar.
 * It encodes identity, stack, dodge, and fill directly into GPU vertices so
 * the Face mark never needs a CPU count-grid readback.
 */
export const HISTOGRAM_BAR_VERTICES_WGSL = `
struct HistogramParams {
  rows: u32,
  bins: u32,
  groups: u32,
  hasGroups: u32,
  lo: f32,
  binwidth: f32,
  position: u32,
};

@group(0) @binding(0) var<storage, read> counts: array<u32>;
@group(0) @binding(1) var<storage, read_write> vertices: array<vec2<f32>>;
@group(0) @binding(2) var<uniform> params: HistogramParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell = global_id.x;
  let cells = params.groups * params.bins;
  if (cell >= cells || params.bins == 0u) {
    return;
  }

  let group = cell / params.bins;
  let bin = cell % params.bins;
  let count = counts[cell];
  var lower = 0u;
  var upper = count;
  if (params.position == 1u || params.position == 3u) {
    for (var prior = 0u; prior < group; prior = prior + 1u) {
      lower = lower + counts[prior * params.bins + bin];
    }
    upper = lower + count;
  }
  let x0 = params.lo + f32(bin) * params.binwidth;
  var x1 = x0 + params.binwidth;
  var left = x0;
  if (params.position == 2u) {
    let width = params.binwidth / f32(params.groups);
    left = x0 + f32(group) * width;
    x1 = left + width;
  }
  var y0 = f32(lower);
  var y1 = f32(upper);
  if (params.position == 3u) {
    var total = 0u;
    for (var index = 0u; index < params.groups; index = index + 1u) {
      total = total + counts[index * params.bins + bin];
    }
    if (total > 0u) {
      y0 = f32(lower) / f32(total);
      y1 = f32(upper) / f32(total);
    } else {
      y0 = 0.0;
      y1 = 0.0;
    }
  }
  let offset = cell * 4u;
  vertices[offset] = vec2<f32>(left, y0);
  vertices[offset + 1u] = vec2<f32>(left, y1);
  vertices[offset + 2u] = vec2<f32>(x1, y1);
  vertices[offset + 3u] = vec2<f32>(x1, y0);
}
`.trim();

/**
 * Emits one rectangular tile for every dense [group, bin] count-grid cell.
 * Counts remain resident for a later color/opacity field; even zero cells keep
 * their declared topology and therefore need no CPU sparse-row reconstruction.
 */
export const HISTOGRAM_TILE_VERTICES_WGSL = `
struct HistogramParams {
  rows: u32,
  bins: u32,
  groups: u32,
  hasGroups: u32,
  lo: f32,
  binwidth: f32,
  position: u32,
};

@group(0) @binding(0) var<storage, read> counts: array<u32>;
@group(0) @binding(1) var<storage, read_write> vertices: array<vec2<f32>>;
@group(0) @binding(2) var<uniform> params: HistogramParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell = global_id.x;
  let cells = params.groups * params.bins;
  if (cell >= cells || params.bins == 0u) {
    return;
  }
  let group = cell / params.bins;
  let bin = cell % params.bins;
  let x0 = params.lo + f32(bin) * params.binwidth;
  let x1 = x0 + params.binwidth;
  let y0 = f32(group);
  let y1 = y0 + 1.0;
  let offset = cell * 4u;
  vertices[offset] = vec2<f32>(x0, y0);
  vertices[offset + 1u] = vec2<f32>(x0, y1);
  vertices[offset + 2u] = vec2<f32>(x1, y1);
  vertices[offset + 3u] = vec2<f32>(x1, y0);
}
`.trim();

/** Produces compact [group totals..., stacked maximum] metadata from counts. */
export const HISTOGRAM_SUMMARY_WGSL = `
struct HistogramParams {
  rows: u32,
  bins: u32,
  groups: u32,
  hasGroups: u32,
  lo: f32,
  binwidth: f32,
  position: u32,
};

@group(0) @binding(0) var<storage, read> counts: array<u32>;
@group(0) @binding(1) var<storage, read_write> summary: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: HistogramParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let bin = global_id.x;
  if (bin >= params.bins) {
    return;
  }
  var stacked = 0u;
  for (var group = 0u; group < params.groups; group = group + 1u) {
    let count = counts[group * params.bins + bin];
    atomicAdd(&summary[group], count);
    stacked = stacked + count;
  }
  if (params.position == 1u) {
    atomicMax(&summary[params.groups], stacked);
  } else if (params.position == 3u) {
    atomicMax(&summary[params.groups], select(0u, 1u, stacked > 0u));
  } else {
    for (var group = 0u; group < params.groups; group = group + 1u) {
      atomicMax(&summary[params.groups], counts[group * params.bins + bin]);
    }
  }
}
`.trim();

export const GROUPED_HISTOGRAM_2D_WGSL = `
struct Histogram2DParams {
  rows: u32,
  xBins: u32,
  yBins: u32,
  groups: u32,
  hasGroups: u32,
  xLo: f32,
  yLo: f32,
  xBinwidth: f32,
  yBinwidth: f32,
};

@group(0) @binding(0) var<storage, read> xValues: array<f32>;
@group(0) @binding(1) var<storage, read> yValues: array<f32>;
@group(0) @binding(2) var<storage, read> groupIds: array<u32>;
@group(0) @binding(3) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> params: Histogram2DParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  if (row >= params.rows || params.xBins == 0u || params.yBins == 0u || params.groups == 0u) {
    return;
  }

  let xRaw = i32(floor((xValues[row] - params.xLo) / params.xBinwidth));
  let yRaw = i32(floor((yValues[row] - params.yLo) / params.yBinwidth));
  let xBin = u32(clamp(xRaw, 0, i32(params.xBins) - 1));
  let yBin = u32(clamp(yRaw, 0, i32(params.yBins) - 1));
  let group = select(0u, groupIds[row], params.hasGroups != 0u);

  if (group >= params.groups) {
    return;
  }

  let offset = group * params.yBins * params.xBins + yBin * params.xBins + xBin;
  atomicAdd(&counts[offset], 1u);
}
`.trim();

export function createGroupedHistogram1dPlan(
  input: Pick<GroupedHistogram1DInput, "values" | "bins" | "groupsCount">,
): WgpuKernelPlan {
  const workgroupSize = 64;
  const bins = Math.max(1, input.bins ?? 30);
  const groupsCount = Math.max(1, input.groupsCount ?? 1);
  return {
    kind: "grouped-histogram-1d",
    workgroupSize,
    dispatchSize: Math.ceil(input.values.length / workgroupSize),
    countsLength: bins * groupsCount,
    shaders: {
      clearU32: CLEAR_U32_WGSL,
      groupedHistogram1D: GROUPED_HISTOGRAM_1D_WGSL,
      histogramBarVertices: HISTOGRAM_BAR_VERTICES_WGSL,
      histogramSummary: HISTOGRAM_SUMMARY_WGSL,
    },
  };
}

export function createGroupedHistogram2dPlan(
  input: Pick<GroupedHistogram2DInput, "x" | "xBins" | "yBins" | "groupsCount">,
): WgpuKernelPlan {
  const workgroupSize = 64;
  const xBins = Math.max(1, input.xBins ?? 30);
  const yBins = Math.max(1, input.yBins ?? 30);
  const groupsCount = Math.max(1, input.groupsCount ?? 1);
  return {
    kind: "grouped-histogram-2d",
    workgroupSize,
    dispatchSize: Math.ceil(input.x.length / workgroupSize),
    countsLength: xBins * yBins * groupsCount,
    shaders: {
      clearU32: CLEAR_U32_WGSL,
      groupedHistogram1D: GROUPED_HISTOGRAM_1D_WGSL,
      groupedHistogram2D: GROUPED_HISTOGRAM_2D_WGSL,
    },
  };
}
