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
};

const unsupported = [
  [/(coord-radial|coord-fixed)/, "grammar gap", "gggplot-aei.4", "coord_radial / coord_fixed"],
  [/facet-.*free/, "grammar gap", "gggplot-aei.6", "free facet scales"],
  [/(theme-|themes-gallery)/, "grammar gap", "gggplot-aei.7", "named/theme-element coverage"],
  [/(bin-2d|hex|contour|qq|ellipse|stat-function|colour-bar|scale-binned)/, "grammar gap", "gggplot-aei.8", "2D/stat/guide long tail"],
  [/(density|dotplot|boxplot)/, "grammar gap", "gggplot-aei.2", "distribution statistics/geoms"],
  [/(jitterdodge|dodge-mixed)/, "grammar gap", "gggplot-aei.5", "advanced position adjustment"],
  [/stroke/, "grammar gap", "gggplot-aei.9", "mapped point stroke"],
  [/^late-binding/, "deferred", "gggplot-aei", "late-binding stages"],
  [/(guide-|sec-axis|shape-character|guide-custom)/, "deferred", "gggplot-aei.8", "advanced guide/axis layout"],
  [/(geom-(curve|spoke|quantile|mark|rect|step|freqpoly)|bump-chart|streamgraph|waffle)/, "grammar gap", "gggplot-aei", "specialised geom topology"],
] as const;

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
]);

function statusFor(slug: string) {
  const hit = unsupported.find(([pattern]) => pattern.test(slug));
  if (hit) {
    const [, classification, owner, contract] = hit;
    return { classification, owner, contract, code: "no", residency: "n/a" };
  }
  if (!supported.has(slug)) {
    return {
      classification: "grammar gap",
      owner: "gggplot-aei",
      contract: "source-specific parity contract",
      code: "no",
      residency: "n/a",
    };
  }
  const resident = slug === "histogram";
  return {
    classification: "supported",
    owner: "gggplot-1ha.9",
    contract: "current DSL/RenderTree contract",
    code: "yes",
    residency: resident ? "resident eligible (literal histogram)" : "CPU reference + WebGPU render",
  };
}

function row(slug: string) {
  const status = statusFor(slug);
  const example = docs[slug] ?? "none";
  const fixture = example === "none" ? "none" : `visual-smoke:#${example.split(":")[0]}`;
  return `| \`${slug}\` | ${status.contract} | ${status.code} | ${example} | ${status.residency} | ${fixture} | ${status.classification} | ${status.owner} |`;
}

const slugs = (await Deno.readTextFile(inventoryPath)).trim().split(/\r?\n/).filter(Boolean);
if (slugs.length !== 129 || new Set(slugs).size !== slugs.length) {
  throw new Error(`Pinned inventory must contain 129 unique slugs; got ${slugs.length}.`);
}

const gallery = await Deno.readTextFile(galleryPath);
const gallerySections = new Map<string, string>();
for (const match of gallery.matchAll(/^- slug: ([^\r\n]+)\r?\n  section: ([^\r\n]+)/gm)) {
  gallerySections.set(match[1], match[2]);
}
if (gallerySections.size !== 127) {
  throw new Error(`Pinned gallery metadata must contain 127 entries; got ${gallerySections.size}.`);
}
for (const slug of gallerySections.keys()) {
  if (!slugs.includes(slug)) throw new Error(`Gallery source ${slug} is absent from the inventory.`);
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
  "This file is generated by `deno run -A scripts/generate_gribouille_parity_matrix.ts`; use `--check` in verification. `yes` means the named grammar contract is present, while code and documentation parity remain intentionally separate. GPU-native is claimed only for the resident-eligible literal histogram path; all other supported entries are CPU-reference lowering rendered with WebGPU.",
  "",
  "| Source | Required grammar contract | Code parity | Docs example parity | Residency | Visual fixture | Classification | Owner / linked bead |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
];
for (const section of [
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
]) {
  const members = sections.get(section) ?? [];
  lines.push(`| **${section} (${members.length})** |  |  |  |  |  |  |  |`);
  lines.push(...members.map(row));
}
lines.push("", "Classification vocabulary: **supported**, **renderer defect**, **grammar gap**, **deferred**. No source is left unclassified; renderer defects are reserved for a supported contract that fails the visual gate.", "");
const generated = lines.join("\n");

if (check) {
  const current = await Deno.readTextFile(outputPath);
  if (current !== generated) throw new Error("Parity matrix is stale; rerun the generator.");
  console.log(`Gribouille parity matrix is current (${slugs.length} sources).`);
} else {
  await Deno.writeTextFile(outputPath, generated);
  console.log(`Wrote ${outputPath.pathname} (${slugs.length} sources).`);
}
