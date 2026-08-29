/**
 * Regenerates the checked-in Gribouille example parity matrix.
 *
 * The inventory is deliberately a plain, pinned list so this check does not
 * depend on a network clone. Refresh it only from the named revision in the
 * matrix header, then run this script and commit both artifacts together.
 */
const root = new URL("../", import.meta.url);
const inventoryPath = new URL("docs/GRIBOUILLE_03DBFDE6_INVENTORY.txt", root);
const galleryPath = new URL("docs/GRIBOUILLE_03DBFDE6_GALLERY.yml", root);
const outputPath = new URL("docs/GRIBOUILLE_PARITY_MATRIX.md", root);
const check = Deno.args.includes("--check");

const docs: Record<string, string> = {
  minimal: "start:ScatterLine",
  multilayer: "start:ScatterLine",
  "labels-title": "guides",
  "labels-tag": "guides",
  histogram: "stats:HistogramStatBin",
  smooth: "stats:SmoothLm",
  "ribbon-bounds": "stats:SmoothLm",
  "bar-count": "stats:CountStackedBar",
  "bar-stacked": "stats:CountStackedBar",
  "bar-dodged": "positions",
  "bar-filled": "positions",
  "bar-simple": "stats:CountStackedBar",
  "geom-polygon": "representations",
  "geom-path": "representations",
  "geom-area": "representations",
  "geom-tile": "representations:TileHeatmap",
  "reference-lines": "annotations:AnnotationComposite",
  annotate: "annotations:AnnotationComposite",
  "facet-grid": "facets:FacetGridStats",
  facets: "facets:FacetedScatter",
  "coord-flip": "coords:FlippedBars",
  "coord-radial-pie": "coords:PolarPoints",
  "coord-radial-rose": "coords:PolarPoints",
  "scale-alpha": "aesthetics:ScaledAesthetics",
  "scale-linewidth": "aesthetics:MtcarsLineStyles",
  "scale-log-sqrt-reverse": "scales:ScaleTransforms",
  "scale-expand": "scales",
  "theme-override": "themes:ThemeComparison",
  themed: "themes:ThemedChart",
  streamgraph: "stats:Streamgraph",
  "bump-chart": "stats:BumpChart",
  waffle: "stats:WaffleChart",
};

const gaps = [
  [
    /(geom-(curve|spoke|step|freqpoly))/,
    "gggplot-8e0.16",
    "simple geom topology",
  ],
  [/geom-count/, "gggplot-8e0.17", "geom_count / stat_sum"],
  [/geom-quantile/, "gggplot-8e0.20", "quantile regression"],
  [
    /(annotate-typst|geom-typst)/,
    "gggplot-8e0.23",
    "rejected: no Typst evaluator",
  ],
  [/streamgraph/, "gggplot-isp.2", "silhouette stack position"],
  [/bump-chart/, "gggplot-isp.3", "stat_connect sigmoid product"],
  [/waffle/, "gggplot-isp.4", "unit-tile stat"],
  [/geom-mark/, "gggplot-pt0", "removed: unused cluster-mark extension"],
  [/^late-binding/, "gggplot-8e0.26", "late-binding transform contract"],
  [
    /(guide-|sec-axis|shape-character|guide-custom)/,
    "gggplot-aei.8",
    "advanced guide/axis layout",
  ],
  [
    /(theme-|themes-gallery)/,
    "gggplot-aei.7",
    "remaining named/theme-element coverage",
  ],
] as const;

const decisions: Record<string, {
  status: string;
  owner: string;
  contract: string;
}> = {
  "bump-chart": {
    status: "full",
    owner: "—",
    contract: "line + sigmoid connection + reversed y",
  },
  streamgraph: {
    status: "full",
    owner: "—",
    contract: "geomArea + silhouette stack offset",
  },
  waffle: {
    status: "full",
    owner: "—",
    contract: "core statWaffle + geomWaffle tile product",
  },
  "annotate-typst": {
    status: "absent",
    owner: "deferred (specialized ADR)",
    contract: "requires foreign rich-text layout engine",
  },
  "geom-typst-const": {
    status: "absent",
    owner: "deferred (specialized ADR)",
    contract: "requires foreign rich-text layout engine",
  },
  "stat-align": {
    status: "absent",
    owner: "gggplot-2a9 (ADR 003)",
    contract: "core shared-grid resampling stat",
  },
  "stat-connect": {
    status: "full",
    owner: "—",
    contract: "linear/step/mid/sigmoid connector product",
  },
  "stat-manual": {
    status: "absent",
    owner: "rejected (ADR 003)",
    contract: "arbitrary closure is not portable",
  },
};

// Keep this deliberately narrow: “supported” is a claim backed by an existing
// DSL/compiler contract, not a guess based on an example name. Everything
// else remains a linked gap until a dedicated fixture proves it.
const supported = new Set([
  "minimal",
  "multilayer",
  "labels-title",
  "labels-tag",
  "factor-inline",
  "penguins",
  "dataset-mpg",
  "aes-promote",
  "bar-simple",
  "bar-count",
  "bar-stacked",
  "bar-dodged",
  "bar-filled",
  "histogram",
  "smooth",
  "ribbon-bounds",
  "reference-lines",
  "reference-lines-aes",
  "annotate",
  "shape-linetype",
  "facets",
  "facet-grid",
  "coord-flip",
  "geom-area",
  "geom-path",
  "geom-polygon",
  "geom-tile",
  "geom-count",
  "stat-summary",
  "weight",
  "jitter",
  "scale-alpha",
  "scale-linewidth",
  "scale-expand",
  "manual-palette",
  "viridis-colour",
  "themed",
  "theme-override",
  "bin-2d",
  "boxplot",
  "colour-bar",
  "contour",
  "contour-filled",
  "coord-fixed",
  "coord-radial-pie",
  "coord-radial-rose",
  "density",
  "dodge-mixed",
  "ellipse",
  "facet-grid-free",
  "facets-free",
  "geom-dotplot",
  "hex",
  "jitterdodge",
  "qq",
  "qq-distributions",
  "scale-binned",
  "stat-function",
  "stroke",
]);

function statusFor(slug: string) {
  const decision = decisions[slug];
  if (decision) {
    return {
      ...decision,
      plumbing: decision.status === "alias" || decision.status === "full"
        ? "✓"
        : "—",
      residency: decision.status === "alias" || decision.status === "full"
        ? "CPU reference + WebGPU render"
        : "n/a",
    };
  }
  const hit = gaps.find(([pattern]) => pattern.test(slug));
  if (hit) {
    const [, owner, contract] = hit;
    return {
      status: "absent",
      owner,
      contract,
      plumbing: "—",
      residency: "n/a",
    };
  }
  if (!supported.has(slug)) {
    return {
      status: "absent",
      owner: "gggplot-8e0.23",
      contract: "source-specific parity contract",
      plumbing: "—",
      residency: "n/a",
    };
  }
  const resident = slug === "histogram";
  return {
    status: slug === "jitter" ? "alias" : "full",
    owner: "—",
    contract: "current DSL/RenderTree contract",
    plumbing: "✓",
    residency: resident
      ? "resident eligible (literal histogram)"
      : "CPU reference + WebGPU render",
  };
}

function row(slug: string) {
  const status = statusFor(slug);
  const example = docs[slug] ?? "none";
  const fixture = example === "none"
    ? "none"
    : `visual-smoke:#${example.split(":")[0]}`;
  return `| \`${slug}\` | ${status.status} | ${status.plumbing} | ${status.plumbing} | ${status.plumbing} | ${status.plumbing} | ${status.plumbing} | ${
    fixture === "none" ? "—" : "✓"
  } | ${example} | ${status.residency} | ${status.owner} |`;
}

const slugs = (await Deno.readTextFile(inventoryPath)).trim().split(/\r?\n/)
  .filter(Boolean);
if (slugs.length !== 129 || new Set(slugs).size !== slugs.length) {
  throw new Error(
    `Pinned inventory must contain 129 unique slugs; got ${slugs.length}.`,
  );
}

const gallery = await Deno.readTextFile(galleryPath);
const gallerySections = new Map<string, string>();
for (
  const match of gallery.matchAll(
    /^- slug: ([^\r\n]+)\r?\n {2}section: ([^\r\n]+)/gm,
  )
) {
  gallerySections.set(match[1], match[2]);
}
if (gallerySections.size !== 127) {
  throw new Error(
    `Pinned gallery metadata must contain 127 entries; got ${gallerySections.size}.`,
  );
}
for (const slug of gallerySections.keys()) {
  if (!slugs.includes(slug)) {
    throw new Error(`Gallery source ${slug} is absent from the inventory.`);
  }
}

const sections = new Map<string, string[]>();
const sectionLabels: Record<string, string> = {
  basics: "Basics",
  bars: "Bars",
  stats: "Stats",
  annotations: "Annotations",
  scales: "Scales",
  facets: "Facets and coords",
  themes: "Themes",
  guides: "Guides",
  geoms: "Geoms",
  "late-binding": "Late binding",
};
for (const slug of slugs) {
  const section = slug === "gribouille" || slug === "showcase"
    ? "Landing examples"
    : sectionLabels[gallerySections.get(slug) ?? ""];
  if (!section) throw new Error(`No pinned gallery section for ${slug}.`);
  sections.set(section, [...(sections.get(section) ?? []), slug]);
}
const lines = [
  "# Gribouille code and example parity matrix",
  "",
  "Inventory source: `mcanouil/gribouille@03dbfde6d3a578741b7e66f62c3c184bf41191ad`, 127 gallery examples plus `gribouille` and `showcase` landing examples (129 total).",
  "",
  "This file is generated by `deno run -A scripts/generate_gribouille_parity_matrix.ts`; use `--check` in verification. Status uses the audit vocabulary: absent, alias, constructor-only, compile-only, runtime-only, partial-stat, or full. Plumbing and gallery evidence are intentionally separate. GPU-native is claimed only for the resident-eligible literal histogram path; all other supported entries are CPU-reference lowering rendered with WebGPU.",
  "",
  "The pinned Gribouille inventory contains no 3D examples, so it cannot establish 3D parity. gggplot's separately tested core contract currently covers `geomPoint()`, `geomLine()`, and `geomPath()` with positional `z`, shared x/y/z scales and guides, one optional `camera3d()` singleton, and the common Live/emitted backends.",
  "",
  "| Source | Status | DSL | IR | Compiler | Live | Emitted | Gallery | Docs example | Residency | Owner / linked bead |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];
for (
  const section of [
    "Basics",
    "Bars",
    "Stats",
    "Annotations",
    "Scales",
    "Facets and coords",
    "Themes",
    "Guides",
    "Geoms",
    "Late binding",
    "Landing examples",
  ]
) {
  const members = sections.get(section) ?? [];
  lines.push(
    `| **${section} (${members.length})** |  |  |  |  |  |  |  |  |  |  |`,
  );
  lines.push(...members.map(row));
}
lines.push(
  "",
  "Status vocabulary: **absent**, **alias**, **constructor-only**, **compile-only**, **runtime-only**, **partial-stat**, **full**. Every source is classified and every absent source links to a focused owner.",
  "",
);
const generated = lines.join("\n");

if (check) {
  const current = await Deno.readTextFile(outputPath);
  if (current !== generated) {
    throw new Error("Parity matrix is stale; rerun the generator.");
  }
  console.log(`Gribouille parity matrix is current (${slugs.length} sources).`);
} else {
  await Deno.writeTextFile(outputPath, generated);
  console.log(`Wrote ${outputPath.pathname} (${slugs.length} sources).`);
}
