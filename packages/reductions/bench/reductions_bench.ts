import {
  groupedCount1d,
  groupedHistogram1d,
  groupedHistogram2d,
  groupedLinearRegression1d,
  groupedSummary1d,
} from "../src/mod.ts";

function ids(length: number, modulo: number): Uint32Array {
  const out = new Uint32Array(length);
  for (let i = 0; i < length; i++) out[i] = i % modulo;
  return out;
}

function values(length: number): Float64Array {
  const out = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = Math.sin(i * 0.017) * 50 + (i % 97);
  }
  return out;
}

const rows = 100_000;
const groups = 8;
const levels = 64;
const xIds = ids(rows, levels);
const groupIds = ids(rows, groups);
const y = values(rows);
const x = new Float32Array(y.length);
const y32 = new Float32Array(y.length);
for (let i = 0; i < y.length; i++) {
  x[i] = (i % 1000) / 10;
  y32[i] = y[i];
}

Deno.bench("groupedCount1d 100k rows", () => {
  groupedCount1d({
    valueIds: xIds,
    valuesCount: levels,
    groupIds,
    groupsCount: groups,
  });
});

Deno.bench("groupedHistogram1d 100k rows", () => {
  groupedHistogram1d({
    values: y32,
    lo: -60,
    hi: 160,
    bins: 80,
    groupIds,
    groupsCount: groups,
  });
});

Deno.bench("groupedSummary1d 100k rows", () => {
  groupedSummary1d({
    xIds,
    xCount: levels,
    values: y,
    groupIds,
    groupsCount: groups,
    includeMedian: false,
  });
});

Deno.bench("groupedSummary1d median 100k rows", () => {
  groupedSummary1d({
    xIds,
    xCount: levels,
    values: y,
    groupIds,
    groupsCount: groups,
    includeMedian: true,
  });
});

Deno.bench("groupedLinearRegression1d 100k rows", () => {
  groupedLinearRegression1d({
    x,
    y: y32,
    groupIds,
    groupsCount: groups,
  });
});

Deno.bench("groupedHistogram2d 100k rows", () => {
  groupedHistogram2d({
    x,
    y: y32,
    xLo: 0,
    xHi: 100,
    yLo: -60,
    yHi: 160,
    xBins: 64,
    yBins: 64,
    groupIds,
    groupsCount: groups,
  });
});
