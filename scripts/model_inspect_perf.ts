/**
 * Model-inspection performance and shape gate (gggplot-i5m.7).
 *
 * Scoped to what the SHIPPING path can actually be measured on. The docs route
 * inspects ONNX statically via inspectOnnx and never imports onnxruntime-web
 * (gggplot-i5m.14 verified this and gated the WASM asset copy on it, which is
 * what keeps dist at ~2.4MB instead of 26MB). There is no inference, so model
 * load, output capture, readback bytes and device compatibility are not
 * measurable here; runtime-shared GPU tensors are gggplot-i5m.22's territory.
 * Interaction responsiveness needs a real GPU and a human (gggplot-i5m.24).
 *
 * What IS measurable, and what this gate covers:
 *   - parse time per bundled .onnx
 *   - node / port / edge / label / tensor counts per fixture
 *   - bytes actually read per tensor-content policy
 *   - residency cache reuse across repeated selections
 *   - built dist size, the regression that matters most for a docs site
 *
 * Counts and byte totals are deterministic, so they are asserted exactly.
 * Wall-clock time is not, so it is reported and bounded by a generous ceiling
 * rather than pinned to a baseline -- a gate that fails on a noisy runner
 * teaches people to ignore it.
 *
 *   deno run -A scripts/model_inspect_perf.ts           # measure and print
 *   deno run -A scripts/model_inspect_perf.ts --check   # compare to baseline
 *   deno run -A scripts/model_inspect_perf.ts --write   # update the baseline
 */
import { inspectOnnx } from "../packages/model-inspect/src/onnx_binary.ts";
import {
  buildGeometryProduct,
  buildTensorContentProduct,
} from "../packages/model-inspect/src/products.ts";
import type {
  TensorRangeRequest,
  TensorSource,
} from "../packages/model-inspect/src/residency.ts";
import type { ModelDocument } from "../packages/model-inspect/src/types.ts";

const root = new URL("../", import.meta.url);
const modelsDir = new URL("apps/site/public/models/", root);
const baselinePath = new URL("docs/model_inspect_baseline.json", root);
const distDir = new URL("apps/site/dist/", root);

/** Mirrors apps/site/src/model_fixtures.ts; kept as bare names on purpose so
 * this script does not depend on the site's deployment-base handling. */
const FIXTURES = [
  "dense-chain.onnx",
  "residual-merge.onnx",
  "multi-head.onnx",
  "mnist-12.onnx",
  "tiny-encoder-stack.onnx",
];

/** Ceiling, not a target: parsing the largest fixture is ~single-digit ms on a
 * laptop, so 250ms still catches an algorithmic regression on a slow runner. */
const PARSE_CEILING_MS = 250;
/** dist is 2.4MB with the ORT WASM assets correctly skipped. 4MB leaves room
 * for docs growth while still failing loudly if the 24MB asyncify build lands
 * in the bundle by accident. */
const DIST_CEILING_KB = 4096;

interface FixtureMeasurement {
  bytes: number;
  nodes: number;
  ports: number;
  edges: number;
  labels: number;
  tensors: number;
  graphs: number;
  /** tensorId -> [representation, bytesRead] for each inspected tensor. */
  content: Record<string, [string, number]>;
  cacheableReads: number;
  /** policy -> [representation actually produced, bytes read] on one probe
   * tensor, so all five content policies are covered rather than just the two
   * that a default "auto" request happens to select. */
  policies: Record<string, [string, number]>;
}

interface Baseline {
  fixtures: Record<string, FixtureMeasurement>;
}

/** Wraps a source so every readRange is counted -- this is the only honest way
 * to measure what a content policy actually pulls, rather than trusting the
 * policy name it reports. */
class CountingSource implements TensorSource {
  readonly id: string;
  readonly version: string;
  readonly byteLength: number;
  bytesRead = 0;
  reads = 0;
  readonly seen = new Set<string>();

  constructor(private readonly inner: TensorSource) {
    this.id = inner.id;
    this.version = inner.version;
    this.byteLength = inner.byteLength;
  }

  readRange(request: TensorRangeRequest): Promise<ArrayBuffer> {
    this.bytesRead += request.byteLength;
    this.reads++;
    this.seen.add(`${request.byteOffset}:${request.byteLength}`);
    return this.inner.readRange(request);
  }
}

async function measure(
  name: string,
): Promise<FixtureMeasurement & { parseMs: number }> {
  const bytes = await Deno.readFile(new URL(name, modelsDir));
  const started = performance.now();
  const inspection = inspectOnnx(bytes, {
    source: { id: `file:${name}`, format: "onnx", kind: "file", uri: name },
  });
  const parseMs = performance.now() - started;
  const document: ModelDocument = inspection.document;

  const geometry = buildGeometryProduct(document);
  const counting = new CountingSource(inspection.source);

  // Deterministic order so byte totals are stable across runs.
  const tensorIds = Object.keys(document.tensors).sort();
  const content: Record<string, [string, number]> = {};
  for (const tensorId of tensorIds) {
    const before = counting.bytesRead;
    const product = await buildTensorContentProduct(document, counting, {
      target: { kind: "tensor", tensorId },
    });
    content[document.tensors[tensorId].name ?? tensorId] = [
      product.representation,
      counting.bytesRead - before,
    ];
  }

  // Re-select every tensor a second time. A residency cache that reuses ranges
  // issues no NEW distinct range on the repeat pass; this records how many
  // distinct ranges the whole two-pass sequence touched.
  const distinctAfterFirstPass = counting.seen.size;
  for (const tensorId of tensorIds) {
    await buildTensorContentProduct(document, counting, {
      target: { kind: "tensor", tensorId },
    });
  }
  if (counting.seen.size !== distinctAfterFirstPass) {
    throw new Error(
      `${name}: re-selecting the same tensors touched new byte ranges ` +
        `(${distinctAfterFirstPass} -> ${counting.seen.size}); the range set ` +
        `for a given selection must be stable.`,
    );
  }

  // Exercise every content policy explicitly. "auto" only ever selects exact
  // or metadata on fixtures this small, which would leave tile, downsample and
  // summary ungated -- exactly the paths that bound reads on a BIG model.
  const probe = tensorIds.find((id) => {
    const shape = document.tensors[id].shape;
    return shape.length === 2 && shape.every((d) => typeof d === "number");
  });
  const policies: Record<string, [string, number]> = {};
  if (probe) {
    for (
      const mode of [
        "exact",
        "tile",
        "downsample",
        "summary",
        "metadata",
      ] as const
    ) {
      const source = new CountingSource(inspection.source);
      const product = await buildTensorContentProduct(document, source, {
        target: { kind: "tensor", tensorId: probe },
        mode,
        ...(mode === "tile" ? { axes: [0, 1] as [number, number] } : {}),
      });
      policies[mode] = [product.representation, source.bytesRead];
    }
  }

  return {
    bytes: bytes.byteLength,
    nodes: geometry.nodes.length,
    ports: geometry.ports.length,
    edges: geometry.edges.length,
    labels: geometry.labels.length,
    tensors: tensorIds.length,
    graphs: document.graphs.length,
    content,
    cacheableReads: distinctAfterFirstPass,
    policies,
    parseMs,
  };
}

async function distKb(): Promise<number | undefined> {
  let total = 0;
  try {
    for await (const entry of walk(distDir)) total += entry;
  } catch {
    return undefined; // not built; the gate reports rather than fails
  }
  return Math.round(total / 1024);
}

async function* walk(dir: URL): AsyncGenerator<number> {
  for await (const entry of Deno.readDir(dir)) {
    const child = new URL(entry.name + (entry.isDirectory ? "/" : ""), dir);
    if (entry.isDirectory) yield* walk(child);
    else yield (await Deno.stat(child)).size;
  }
}

const check = Deno.args.includes("--check");
const write = Deno.args.includes("--write");

const measured: Record<string, FixtureMeasurement> = {};
const timings: Record<string, number> = {};
const failures: string[] = [];

for (const name of FIXTURES) {
  const { parseMs, ...rest } = await measure(name);
  measured[name] = rest;
  timings[name] = parseMs;
  if (parseMs > PARSE_CEILING_MS) {
    failures.push(
      `${name}: parsed in ${
        parseMs.toFixed(1)
      }ms, over the ${PARSE_CEILING_MS}ms ceiling`,
    );
  }
}

const kb = await distKb();

console.log("Model inspection measurements\n");
console.log(
  "fixture".padEnd(26) + "bytes".padStart(8) + "nodes".padStart(7) +
    "ports".padStart(7) + "edges".padStart(7) + "tensors".padStart(9) +
    "read B".padStart(9) + "parse".padStart(9),
);
for (const name of FIXTURES) {
  const m = measured[name];
  const readBytes = Object.values(m.content).reduce((a, [, b]) => a + b, 0);
  console.log(
    name.padEnd(26) + String(m.bytes).padStart(8) +
      String(m.nodes).padStart(7) +
      String(m.ports).padStart(7) + String(m.edges).padStart(7) +
      String(m.tensors).padStart(9) + String(readBytes).padStart(9) +
      `${timings[name].toFixed(1)}ms`.padStart(9),
  );
}
console.log("\nbytes read per content policy (one rank-2 probe tensor each)");
console.log(
  "fixture".padEnd(26) +
    ["exact", "tile", "downsample", "summary", "metadata"]
      .map((m) => m.padStart(12)).join(""),
);
for (const name of FIXTURES) {
  const p = measured[name].policies;
  if (!Object.keys(p).length) {
    console.log(name.padEnd(26) + "  (no rank-2 tensor to probe)");
    continue;
  }
  console.log(
    name.padEnd(26) +
      ["exact", "tile", "downsample", "summary", "metadata"]
        .map((m) => `${p[m]?.[1] ?? 0}B`.padStart(12)).join(""),
  );
}
console.log(`dist: ${kb === undefined ? "not built" : `${kb} KB`}`);

if (kb !== undefined && kb > DIST_CEILING_KB) {
  failures.push(
    `dist is ${kb} KB, over the ${DIST_CEILING_KB} KB ceiling. If the ONNX ` +
      `Runtime WASM assets started shipping, that is the cause.`,
  );
}

if (write) {
  await Deno.writeTextFile(
    baselinePath,
    JSON.stringify({ fixtures: measured } satisfies Baseline, null, 2) + "\n",
  );
  console.log(`\nwrote ${baselinePath.pathname}`);
}

if (check) {
  const baseline: Baseline = JSON.parse(await Deno.readTextFile(baselinePath));
  for (const name of FIXTURES) {
    const want = baseline.fixtures[name];
    if (!want) {
      failures.push(`${name}: absent from the baseline; re-run with --write`);
      continue;
    }
    const got = measured[name];
    for (
      const key of [
        "bytes",
        "nodes",
        "ports",
        "edges",
        "labels",
        "tensors",
        "graphs",
        "cacheableReads",
      ] as const
    ) {
      if (got[key] !== want[key]) {
        failures.push(`${name}: ${key} ${got[key]}, baseline ${want[key]}`);
      }
    }
    for (const [mode, [rep, read]] of Object.entries(want.policies ?? {})) {
      const mine = got.policies[mode];
      if (!mine) {
        failures.push(`${name}: policy ${mode} missing`);
      } else if (mine[0] !== rep || mine[1] !== read) {
        failures.push(
          `${name}: policy ${mode} now ${mine[0]}/${
            mine[1]
          }B, baseline ${rep}/${read}B`,
        );
      }
    }
    for (const [tensor, [rep, read]] of Object.entries(want.content)) {
      const mine = got.content[tensor];
      if (!mine) {
        failures.push(`${name}: tensor ${tensor} missing`);
      } else if (mine[0] !== rep || mine[1] !== read) {
        failures.push(
          `${name}: ${tensor} now ${mine[0]}/${
            mine[1]
          }B, baseline ${rep}/${read}B`,
        );
      }
    }
  }
}

if (failures.length) {
  console.error("\nFAILURES:");
  for (const failure of failures) console.error("  " + failure);
  Deno.exit(1);
}
console.log(check ? "\nModel inspection gate passed." : "");
