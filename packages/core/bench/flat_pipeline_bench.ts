// Staged perf bench for the flat-tensor pipeline (gggplot-tzc.8). Mirrors
// packages/reductions/bench/reductions_bench.ts's `Deno.bench` convention.
// Four stages, kept SEPARATE per the bead's brief:
//   (a) packing            — geom/shared.ts's packMarkRows/packFaceLoops/
//                             concatPacked+concatFlatTensors, called directly
//                             (no RenderNode wrapping yet).
//   (b) coordinate transform/munch — compile/coordinates.ts's
//                             polarizeNode+munchPolygonNode+munchFlatNode
//                             (the exact composition compile/pack_cache.ts's
//                             stageBTransformedMark uses), run against a
//                             POLAR view (the only view that actually does
//                             this work — see the Cartesian note below).
//   (c) RenderTree construction — the full compile(spec) pipeline via the
//                             public DSL (stat -> scale training -> geom
//                             lowering incl. its own packing -> guides).
//                             This is the realistic "build the tree" number;
//                             it is NOT a clean isolate of packing (it
//                             necessarily repeats stage (a)'s cost inside
//                             each geom's lower()) — documented, not hidden.
//   (d) emission            — emit/mod.ts's emitSource(tree) on stage (c)'s
//                             output.
//
// 10k/100k rows run as ordinary Deno.bench cases (deno's own adaptive
// repeat-until-~1s harness). The 1M-row case is BOUNDED per the bead's
// requirement ("fixed warmup + a hard per-case time budget"): each 1M stage
// runs a FIXED 1 warmup call + 1 measured call at MODULE LOAD time (not
// inside a Deno.bench fn deno's harness would otherwise repeat-call an
// unbounded number of times), throws if it exceeds its documented budget,
// and is exposed as a trivial Deno.bench that just re-asserts the
// already-measured elapsed time against its budget (cheap to repeat-call).
// Real numbers from a run of this file are recorded in docs/PERF_BASELINE.md.
import {
  concatFlatTensors,
  concatPacked,
  type FaceLoop,
  packFaceLoops,
  type PackedGeometry,
  packMarkRows,
} from "../src/geom/shared.ts";
import {
  munchFlatNode,
  munchPolygonNode,
  polarizeNode,
} from "../src/compile/coordinates.ts";
import { node, type RenderNode } from "../src/compile/rendertree.ts";
import { compile } from "../src/compile/mod.ts";
import { emitSource } from "../src/emit/mod.ts";
import { aes, geomBar, geomLine, geomPoint, ggplot } from "../src/dsl/mod.ts";

// ---------------------------------------------------------------------------
// Synthetic data generators — plain arrays, no Deno RNG dependency (fast,
// deterministic, reproducible across runs so bench numbers aren't noise from
// data generation itself).
// ---------------------------------------------------------------------------

const PALETTE = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];
const GROUP_COUNT = 8;
const BAR_CATEGORY_COUNT = 50;
const BAR_FILL_COUNT = 5;

function pointRows(n: number) {
  const xs = new Array<number>(n);
  const ys = new Array<number>(n);
  const colors = new Array<string>(n);
  const sizes = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    xs[i] = Math.sin(i * 0.0001) * 1000 + i * 0.001;
    ys[i] = Math.cos(i * 0.0003) * 500;
    colors[i] = PALETTE[i % PALETTE.length];
    sizes[i] = 2 + (i % 7);
  }
  return { xs, ys, colors, sizes };
}

/** One group's worth of pre-sorted-by-x rows, matching what lowerLine hands to packMarkRows per effective group. */
function lineGroupRows(n: number, groupIndex: number) {
  const xs = new Array<number>(n);
  const ys = new Array<number>(n);
  const colors = new Array<string>(n).fill(PALETTE[groupIndex % PALETTE.length]);
  const widths = new Array<number>(n).fill(2);
  for (let i = 0; i < n; i++) {
    xs[i] = i;
    ys[i] = Math.sin((i + groupIndex * 37) * 0.002) * 100 + groupIndex * 20;
  }
  return { xs, ys, colors, widths };
}

function barLoops(n: number): FaceLoop[] {
  const loops: FaceLoop[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const cat = i % BAR_CATEGORY_COUNT;
    const x0 = cat, x1 = cat + 0.9;
    const y0 = i % 10, y1 = y0 + 1;
    loops[i] = {
      positions: [[x0, y0], [x0, y1], [x1, y1], [x1, y0]],
      fill: PALETTE[i % BAR_FILL_COUNT % PALETTE.length],
    };
  }
  return loops;
}

// ---------------------------------------------------------------------------
// Stage (a): packing
// ---------------------------------------------------------------------------

function packPoint(n: number): void {
  const { xs, ys, colors, sizes } = pointRows(n);
  packMarkRows({ xs, ys, colors, sizes });
}

function packGroupedLine(n: number): void {
  const perGroup = Math.ceil(n / GROUP_COUNT);
  const positionGeoms: PackedGeometry[] = [];
  const colorTensors = [];
  const widthTensors = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    const { xs, ys, colors, widths } = lineGroupRows(perGroup, g);
    const packed = packMarkRows({ xs, ys, colors, widths });
    positionGeoms.push({
      positions: packed.positions,
      topology: { kind: "polyline", loops: false },
    });
    colorTensors.push(packed.colors!);
    widthTensors.push(packed.widths!);
  }
  concatPacked(positionGeoms);
  concatFlatTensors(colorTensors);
  concatFlatTensors(widthTensors);
}

function packStackedBar(n: number): void {
  packFaceLoops(barLoops(n));
}

// ---------------------------------------------------------------------------
// Stage (b): coordinate transform/munch (polar variant — see file header for
// why Cartesian has no analogous work to measure here).
// ---------------------------------------------------------------------------

function transformPolarPoint(n: number): void {
  const { xs, ys, colors, sizes } = pointRows(n);
  const packed = packMarkRows({ xs, ys, colors, sizes });
  const mark = node("Point", {
    positions: packed.positions,
    topology: { kind: "points" },
    colors: packed.colors,
    sizes: packed.sizes,
  });
  munchFlatNode(munchPolygonNode(polarizeNode(mark, 0, [0, n], -Math.PI, Math.PI)));
}

function transformPolarGroupedLine(n: number): void {
  const perGroup = Math.ceil(n / GROUP_COUNT);
  const positionGeoms: PackedGeometry[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    const { xs, ys, colors, widths } = lineGroupRows(perGroup, g);
    const packed = packMarkRows({ xs, ys, colors, widths });
    positionGeoms.push({
      positions: packed.positions,
      topology: { kind: "polyline", loops: false },
    });
  }
  const combined = concatPacked(positionGeoms);
  const mark = node("ChunkedLine", {
    positions: combined.positions,
    topology: combined.topology,
  });
  munchFlatNode(munchPolygonNode(polarizeNode(mark, 0, [0, perGroup], -Math.PI, Math.PI)));
}

function transformPolarStackedBar(n: number): void {
  const packed = packFaceLoops(barLoops(n));
  const mark = node("ChunkedFace", {
    positions: packed.positions,
    topology: packed.topology,
    colors: packed.colors,
    concave: false,
  });
  munchFlatNode(
    munchPolygonNode(polarizeNode(mark, 0, [0, BAR_CATEGORY_COUNT], -Math.PI, Math.PI)),
  );
}

// ---------------------------------------------------------------------------
// Stage (c): RenderTree construction (full compile()) + Stage (d): emission
// ---------------------------------------------------------------------------

function pointSpec(n: number) {
  const { xs, ys } = pointRows(n);
  return ggplot({ x: xs, y: ys }, aes({ x: "x", y: "y" })).add(geomPoint())
    .build();
}

function lineSpec(n: number) {
  const perGroup = Math.ceil(n / GROUP_COUNT);
  const xs: number[] = [], ys: number[] = [], gs: string[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    const rows = lineGroupRows(perGroup, g);
    for (let i = 0; i < perGroup; i++) {
      xs.push(rows.xs[i]);
      ys.push(rows.ys[i]);
      gs.push(`g${g}`);
    }
  }
  return ggplot({ x: xs, y: ys, g: gs }, aes({ x: "x", y: "y", color: "g" }))
    .add(geomLine()).build();
}

function barSpec(n: number) {
  const cls: string[] = [], fill: string[] = [], v: number[] = [];
  for (let i = 0; i < n; i++) {
    cls.push(`c${i % BAR_CATEGORY_COUNT}`);
    fill.push(`f${i % BAR_FILL_COUNT}`);
    v.push(1 + (i % 10));
  }
  return ggplot({ cls, fill, v }, aes({ x: "cls", y: "v", fill: "fill" }))
    .add(geomBar({ position: "stack" })).build();
}

function constructTree(buildSpec: () => ReturnType<typeof pointSpec>): RenderNode {
  return compile(buildSpec());
}

function emit(buildSpec: () => ReturnType<typeof pointSpec>): string {
  return emitSource(compile(buildSpec()));
}

// ---------------------------------------------------------------------------
// 10k / 100k — ordinary Deno.bench cases.
// ---------------------------------------------------------------------------

const SIZES = [10_000, 100_000] as const;

for (const n of SIZES) {
  Deno.bench(`(a) pack point — ${n} rows`, { group: "pack-point" }, () => {
    packPoint(n);
  });
  Deno.bench(`(a) pack grouped line — ${n} rows`, { group: "pack-line" }, () => {
    packGroupedLine(n);
  });
  Deno.bench(`(a) pack stacked bar — ${n} rows`, { group: "pack-bar" }, () => {
    packStackedBar(n);
  });

  Deno.bench(`(b) polar transform point — ${n} rows`, { group: "transform-point" }, () => {
    transformPolarPoint(n);
  });
  Deno.bench(`(b) polar transform grouped line — ${n} rows`, { group: "transform-line" }, () => {
    transformPolarGroupedLine(n);
  });
  Deno.bench(`(b) polar transform stacked bar — ${n} rows`, { group: "transform-bar" }, () => {
    transformPolarStackedBar(n);
  });

  Deno.bench(`(c) construct RenderTree point — ${n} rows`, { group: "construct-point" }, () => {
    constructTree(() => pointSpec(n));
  });
  Deno.bench(`(c) construct RenderTree grouped line — ${n} rows`, { group: "construct-line" }, () => {
    constructTree(() => lineSpec(n));
  });
  Deno.bench(`(c) construct RenderTree stacked bar — ${n} rows`, { group: "construct-bar" }, () => {
    constructTree(() => barSpec(n));
  });

  Deno.bench(`(d) emit point — ${n} rows`, { group: "emit-point" }, () => {
    emit(() => pointSpec(n));
  });
  Deno.bench(`(d) emit grouped line — ${n} rows`, { group: "emit-line" }, () => {
    emit(() => lineSpec(n));
  });
  Deno.bench(`(d) emit stacked bar — ${n} rows`, { group: "emit-bar" }, () => {
    emit(() => barSpec(n));
  });
}

// ---------------------------------------------------------------------------
// 1M — BOUNDED: fixed 1 warmup + 1 measured call at module load, hard budget.
// ---------------------------------------------------------------------------

const ONE_MILLION = 1_000_000;

interface BoundResult {
  label: string;
  ms: number;
  budgetMs: number;
}

const boundResults: BoundResult[] = [];

/** Fixed warmup (1 run, discarded) + 1 measured run, asserted against a hard budget. Runs ONCE at module scope — see file header. */
function boundedOnce(label: string, budgetMs: number, fn: () => void): number {
  fn(); // warmup (discarded)
  const start = performance.now();
  fn();
  const ms = performance.now() - start;
  boundResults.push({ label, ms, budgetMs });
  if (ms > budgetMs) {
    throw new Error(
      `1M-row bound exceeded: "${label}" took ${
        ms.toFixed(1)
      }ms, budget is ${budgetMs}ms`,
    );
  }
  return ms;
}

// Budgets are deliberately generous ceilings (regression gates, not targets)
// — see docs/PERF_BASELINE.md for the actual measured numbers from a run of
// this file on the reference hardware documented there.
boundedOnce("(a) pack point — 1,000,000 rows", 4_000, () => packPoint(ONE_MILLION));
boundedOnce(
  "(a) pack grouped line — 1,000,000 rows",
  4_000,
  () => packGroupedLine(ONE_MILLION),
);
boundedOnce(
  "(a) pack stacked bar — 1,000,000 rows",
  6_000,
  () => packStackedBar(ONE_MILLION),
);

boundedOnce(
  "(b) polar transform point — 1,000,000 rows",
  4_000,
  () => transformPolarPoint(ONE_MILLION),
);
boundedOnce(
  "(b) polar transform grouped line — 1,000,000 rows",
  8_000,
  () => transformPolarGroupedLine(ONE_MILLION),
);
boundedOnce(
  "(b) polar transform stacked bar — 1,000,000 rows",
  10_000,
  () => transformPolarStackedBar(ONE_MILLION),
);

boundedOnce(
  "(c) construct RenderTree point — 1,000,000 rows",
  6_000,
  () => constructTree(() => pointSpec(ONE_MILLION)),
);
boundedOnce(
  "(c) construct RenderTree grouped line — 1,000,000 rows",
  8_000,
  () => constructTree(() => lineSpec(ONE_MILLION)),
);
boundedOnce(
  "(c) construct RenderTree stacked bar — 1,000,000 rows",
  12_000,
  () => constructTree(() => barSpec(ONE_MILLION)),
);

boundedOnce(
  "(d) emit point — 1,000,000 rows",
  8_000,
  () => emit(() => pointSpec(ONE_MILLION)),
);
boundedOnce(
  "(d) emit grouped line — 1,000,000 rows",
  10_000,
  () => emit(() => lineSpec(ONE_MILLION)),
);
boundedOnce(
  "(d) emit stacked bar — 1,000,000 rows",
  14_000,
  () => emit(() => barSpec(ONE_MILLION)),
);

console.log("\n1M-row bounded stage results (fixed 1 warmup + 1 measured run):");
console.table(
  boundResults.map((r) => ({
    stage: r.label,
    ms: r.ms.toFixed(1),
    budgetMs: r.budgetMs,
    withinBudget: r.ms <= r.budgetMs,
  })),
);

// Trivial Deno.bench wrappers so `deno bench` (which discovers/repeat-calls
// bench fns) reports these too, WITHOUT redoing the 1M-row work above per
// iteration — each just re-asserts the already-measured elapsed time.
for (const result of boundResults) {
  Deno.bench(`[1M bounded] ${result.label}`, { group: "bounded-1m" }, () => {
    if (result.ms > result.budgetMs) {
      throw new Error(`${result.label} exceeded its budget`);
    }
  });
}
