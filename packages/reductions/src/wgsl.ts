import type {
  GroupedHistogram1DInput,
  GroupedHistogram2DInput,
  WgpuKernelPlan,
} from "./types.ts";

/**
 * Shared pass BODY for the u32 grid clear, with no bindings of its own.
 *
 * Dual surface, same rule as DOMAIN_CLEAR_BODY: reach the length through
 * getSize() rather than a bound uniform, so one copy of the logic compiles both
 * under the hand-numbered preamble the standalone executor uses and under the
 * `@link` preamble Use.GPU's <Kernel> links.
 *
 * This one is worth the indirection more than most: it is dispatched FOUR times
 * across the resident kernels (the count grid and its summary, the histogram
 * grid and its summary), each against a different buffer and length.
 */
export const CLEAR_U32_BODY: string = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= getSize().x) {
    return;
  }
  values[i] = 0u;
}
`.trim();

/** Hand-numbered preamble for the standalone (non-Use.GPU) executor. */
export const CLEAR_U32_RAW_PREAMBLE: string = `
@group(0) @binding(0) var<storage, read_write> values: array<u32>;
@group(0) @binding(1) var<uniform> len: u32;

fn getSize() -> vec2<u32> {
  return vec2<u32>(len, 1u);
}
`.trim();

export const CLEAR_U32_WGSL: string =
  `${CLEAR_U32_RAW_PREAMBLE}\n\n${CLEAR_U32_BODY}`;

/** Initializes the ordered-float [minimum, maximum] domain accumulator. */
/**
 * Shared pass BODY for the domain-clear kernel, with no bindings of its own.
 *
 * DUAL SURFACE (gggplot-vs7.6): the body is written against ACCESSORS rather
 * than against bound variables, so exactly one copy of the logic can be
 * compiled two ways — under the hand-numbered `@group/@binding` preamble the
 * standalone Deno executor uses, and under the `@link` preamble Use.GPU's
 * <Kernel> links. The two forms deliberately do NOT have the same bindings
 * (scalar params become <Kernel> uniform refs), so the invariant that matters
 * is identical OUTPUT for identical input, not identical layout.
 *
 * Everything below the preamble must therefore stay binding-agnostic: reach
 * inputs through getValue()/getSize(), and write only through `domain`.
 */
export const DOMAIN_CLEAR_BODY: string = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i >= getSize().x) {
    return;
  }
  // Slot 0 accumulates a minimum and slot 1 a maximum, so they seed from
  // opposite ends of the ordered-bit range.
  atomicStore(&domain[i], select(0u, 0xffffffffu, i == 0u));
}
`.trim();

/** Hand-numbered preamble for the standalone (non-Use.GPU) executor. */
export const DOMAIN_CLEAR_RAW_PREAMBLE: string = `
@group(0) @binding(0) var<storage, read_write> domain: array<atomic<u32>>;

// The accumulator is a fixed pair. This is a function rather than a binding so
// the body can stay identical to the linked form, where <Kernel> supplies the
// same value as its dispatch size.
fn getSize() -> vec2<u32> {
  return vec2<u32>(2u, 1u);
}
`.trim();

export const DOMAIN_CLEAR_WGSL: string =
  `${DOMAIN_CLEAR_RAW_PREAMBLE}\n\n${DOMAIN_CLEAR_BODY}`;

/** Reduces finite f32 values to an ordered-bit [minimum, maximum] pair. */
/**
 * Shared pass BODY for the finite-domain reduction. See DOMAIN_CLEAR_BODY for
 * the dual-surface rule this obeys: inputs come from getValue()/getSize(), and
 * the only bound name it touches directly is the atomic `domain` target.
 */
export const FINITE_DOMAIN_1D_BODY: string = `
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
  if (row >= getSize().x) {
    return;
  }
  let value = getValue(row);
  if (!isFiniteValue(value)) {
    return;
  }
  let ordered = orderedBits(value);
  atomicMin(&domain[0], ordered);
  atomicMax(&domain[1], ordered);
}
`.trim();

/**
 * Hand-numbered preamble for the standalone executor. It defines getValue and
 * getSize as ordinary functions over its own bindings, which is what lets the
 * body stay identical to the linked form.
 */
export const FINITE_DOMAIN_1D_RAW_PREAMBLE: string = `
@group(0) @binding(0) var<storage, read> valuesStorage: array<f32>;
@group(0) @binding(1) var<storage, read_write> domain: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> rowCount: u32;

fn getValue(i: u32) -> f32 {
  return valuesStorage[i];
}

fn getSize() -> vec2<u32> {
  return vec2<u32>(rowCount, 1u);
}
`.trim();

export const FINITE_DOMAIN_1D_WGSL: string =
  `${FINITE_DOMAIN_1D_RAW_PREAMBLE}\n\n${FINITE_DOMAIN_1D_BODY}`;

export const GROUPED_HISTOGRAM_1D_WGSL: string = `
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

/**
 * Shared pass BODY for the grouped categorical count, with no bindings.
 *
 * Both inputs are read through accessors, which is what lets the linked form
 * take them as <Kernel>'s plural `sources` while the standalone form keeps its
 * two hand-numbered storage bindings.
 */
export const GROUPED_COUNT_1D_BODY: string = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  let values = getValues();
  let groups = getGroups();
  if (row >= getSize().x || values == 0u || groups == 0u) {
    return;
  }
  let value = getValueId(row);
  let group = select(0u, getGroupId(row), getHasGroups() != 0u);
  if (value >= values || group >= groups) {
    return;
  }
  atomicAdd(&counts[group * values + value], 1u);
}
`.trim();

/** Hand-numbered preamble for the standalone executor; bindings unchanged. */
export const GROUPED_COUNT_1D_RAW_PREAMBLE: string = `
struct CountParams {
  rows: u32,
  values: u32,
  groups: u32,
  hasGroups: u32,
};

@group(0) @binding(0) var<storage, read> valueIdsStorage: array<u32>;
@group(0) @binding(1) var<storage, read> groupIdsStorage: array<u32>;
@group(0) @binding(2) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> params: CountParams;

fn getSize() -> vec2<u32> {
  return vec2<u32>(params.rows, 1u);
}

fn getValues() -> u32 {
  return params.values;
}

fn getGroups() -> u32 {
  return params.groups;
}

fn getHasGroups() -> u32 {
  return params.hasGroups;
}

fn getValueId(i: u32) -> u32 {
  return valueIdsStorage[i];
}

fn getGroupId(i: u32) -> u32 {
  return groupIdsStorage[i];
}
`.trim();

export const GROUPED_COUNT_1D_WGSL: string =
  `${GROUPED_COUNT_1D_RAW_PREAMBLE}\n\n${GROUPED_COUNT_1D_BODY}`;

/** Expands a [group, category] count grid into 0.9-wide categorical bars. */
/**
 * Shared pass BODY for expanding a count grid into bar quad vertices, with no
 * bindings of its own. The widest of these: two inputs (the grid and the
 * per-group summary), one output, and three scalars.
 */
export const COUNT_BAR_VERTICES_BODY: string = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell = global_id.x;
  let values = getValues();
  let groups = getGroups();
  if (cell >= getSize().x || values == 0u) { return; }
  let group = cell / values;
  let value = cell % values;
  let count = getCount(cell);
  let position = getPosition();
  var lower = 0u;
  var upper = count;
  if (position == 1u || position == 3u) {
    for (var prior = 0u; prior < group; prior = prior + 1u) {
      lower = lower + getCount(prior * values + value);
    }
    upper = lower + count;
  }
  var width = 0.9;
  var left = f32(value) - width * 0.5;
  if (position == 2u) {
    // Dodge divides the band among groups PRESENT in the data (matching CPU
    // dodgeBars, which slots only observed group keys), not the declared
    // group-dictionary size. getSummary(g) holds group g's total count and is
    // dispatched before this pass; an absent group's cell stays degenerate
    // (count 0) so its slot collision is invisible.
    var present = 0u;
    var slot = 0u;
    for (var g = 0u; g < groups; g = g + 1u) {
      if (getSummary(g) > 0u) {
        if (g < group) { slot = slot + 1u; }
        present = present + 1u;
      }
    }
    width = width / f32(max(present, 1u));
    left = f32(value) - 0.45 + f32(slot) * width;
  }
  var y0 = f32(lower);
  var y1 = f32(upper);
  if (position == 3u) {
    var total = 0u;
    for (var index = 0u; index < groups; index = index + 1u) {
      total = total + getCount(index * values + value);
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

/** Hand-numbered preamble for the standalone executor; bindings unchanged. */
export const COUNT_BAR_VERTICES_RAW_PREAMBLE: string = `
struct CountParams {
  rows: u32,
  values: u32,
  groups: u32,
  hasGroups: u32,
  unusedLo: f32,
  unusedWidth: f32,
  position: u32,
};
@group(0) @binding(0) var<storage, read> countsStorage: array<u32>;
@group(0) @binding(1) var<storage, read_write> vertices: array<vec2<f32>>;
@group(0) @binding(2) var<uniform> params: CountParams;
@group(0) @binding(3) var<storage, read> summaryStorage: array<u32>;

fn getSize() -> vec2<u32> {
  return vec2<u32>(params.groups * params.values, 1u);
}

fn getValues() -> u32 {
  return params.values;
}

fn getGroups() -> u32 {
  return params.groups;
}

fn getPosition() -> u32 {
  return params.position;
}

fn getCount(i: u32) -> u32 {
  return countsStorage[i];
}

fn getSummary(i: u32) -> u32 {
  return summaryStorage[i];
}
`.trim();

export const COUNT_BAR_VERTICES_WGSL: string =
  `${COUNT_BAR_VERTICES_RAW_PREAMBLE}\n\n${COUNT_BAR_VERTICES_BODY}`;

/**
 * Expands the resident [group, bin] count grid into four XY vertices per bar.
 * It encodes identity, stack, dodge, and fill directly into GPU vertices so
 * the Face mark never needs a CPU count-grid readback.
 */
export const HISTOGRAM_BAR_VERTICES_WGSL: string = `
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
@group(0) @binding(3) var<storage, read> summary: array<u32>;

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
    // Dodge divides the bin among groups PRESENT in the data (matching CPU
    // dodgeBars, which slots only observed group keys), not the declared
    // group-dictionary size. summary[g] holds group g's total count and is
    // dispatched before this pass; an absent group's cell stays degenerate
    // (count 0) so its slot collision is invisible.
    var present = 0u;
    var slot = 0u;
    for (var g = 0u; g < params.groups; g = g + 1u) {
      if (summary[g] > 0u) {
        if (g < group) { slot = slot + 1u; }
        present = present + 1u;
      }
    }
    let width = params.binwidth / f32(max(present, 1u));
    left = x0 + f32(slot) * width;
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
export const HISTOGRAM_TILE_VERTICES_WGSL: string = `
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
/**
 * Shared pass BODY for the grid summary (per-group totals plus the position's
 * stacked maximum), with no bindings of its own.
 *
 * Dual surface, and the most instructive of the three so far: every SCALAR this
 * pass needs — the bin count, the group count, the position mode — is reached
 * through an accessor. The standalone preamble reads them out of its existing
 * HistogramParams uniform; the linked form gets them as <Kernel> `args`, which
 * become uniform refs whose updates do not rebuild the pipeline.
 */
export const GRID_SUMMARY_BODY: string = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let bins = getSize().x;
  let bin = global_id.x;
  if (bin >= bins) {
    return;
  }
  let groups = getGroups();
  var stacked = 0u;
  for (var group = 0u; group < groups; group = group + 1u) {
    let count = getCount(group * bins + bin);
    atomicAdd(&summary[group], count);
    stacked = stacked + count;
  }
  let position = getPosition();
  if (position == 1u) {
    atomicMax(&summary[groups], stacked);
  } else if (position == 3u) {
    atomicMax(&summary[groups], select(0u, 1u, stacked > 0u));
  } else {
    for (var group = 0u; group < groups; group = group + 1u) {
      atomicMax(&summary[groups], getCount(group * bins + bin));
    }
  }
}
`.trim();

/**
 * Hand-numbered preamble for the standalone executor.
 *
 * Bindings 0/1/2 and the HistogramParams layout are unchanged, so the existing
 * bind groups in resident_count.ts and resident_histogram.ts keep working
 * untouched — only the accessor indirection is new.
 */
export const GRID_SUMMARY_RAW_PREAMBLE: string = `
struct HistogramParams {
  rows: u32,
  bins: u32,
  groups: u32,
  hasGroups: u32,
  lo: f32,
  binwidth: f32,
  position: u32,
};

@group(0) @binding(0) var<storage, read> countsStorage: array<u32>;
@group(0) @binding(1) var<storage, read_write> summary: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> params: HistogramParams;

fn getSize() -> vec2<u32> {
  return vec2<u32>(params.bins, 1u);
}

fn getGroups() -> u32 {
  return params.groups;
}

fn getPosition() -> u32 {
  return params.position;
}

fn getCount(i: u32) -> u32 {
  return countsStorage[i];
}
`.trim();

export const HISTOGRAM_SUMMARY_WGSL: string =
  `${GRID_SUMMARY_RAW_PREAMBLE}\n\n${GRID_SUMMARY_BODY}`;

/**
 * Expands a per-group palette into per-vertex bar colors. One invocation per
 * [group, cell] writes four identical RGBA vertices (the bar's four corners),
 * matching the four-vertex-per-cell layout the bar-vertex kernels emit.
 *
 * The params uniform is SHARED with the count/histogram bar kernels: their
 * struct's second field is the per-group grid width (bins for the histogram,
 * values for the count) and the third is the group count. Reading only those
 * two fields lets one kernel derive `group = cell / perGroup` for either
 * source — the same trick HISTOGRAM_SUMMARY_WGSL relies on. A larger bound
 * uniform buffer (32 bytes) is legal against this three-field view.
 */
/**
 * Shared pass BODY for expanding a per-group palette into per-vertex bar
 * colors, with no bindings of its own.
 *
 * The cell count is taken straight from getSize() rather than recomputed as
 * groups*perGroup, so the group count stops being an input here entirely — the
 * dispatch size already carries it.
 */
export const GRID_BAR_VERTEX_COLORS_BODY: string = `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let cell = global_id.x;
  let perGroup = getPerGroup();
  if (cell >= getSize().x || perGroup == 0u) {
    return;
  }
  let color = getPaletteColor(cell / perGroup);
  let offset = cell * 4u;
  colors[offset] = color;
  colors[offset + 1u] = color;
  colors[offset + 2u] = color;
  colors[offset + 3u] = color;
}
`.trim();

/** Hand-numbered preamble for the standalone executor; bindings unchanged. */
export const GRID_BAR_VERTEX_COLORS_RAW_PREAMBLE: string = `
struct GridParams {
  rows: u32,
  perGroup: u32,
  groups: u32,
};

@group(0) @binding(0) var<storage, read> paletteStorage: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> colors: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: GridParams;

fn getSize() -> vec2<u32> {
  return vec2<u32>(params.groups * params.perGroup, 1u);
}

fn getPerGroup() -> u32 {
  return params.perGroup;
}

fn getPaletteColor(i: u32) -> vec4<f32> {
  return paletteStorage[i];
}
`.trim();

export const GRID_BAR_VERTEX_COLORS_WGSL: string =
  `${GRID_BAR_VERTEX_COLORS_RAW_PREAMBLE}\n\n${GRID_BAR_VERTEX_COLORS_BODY}`;

export const GROUPED_HISTOGRAM_2D_WGSL: string = `
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
