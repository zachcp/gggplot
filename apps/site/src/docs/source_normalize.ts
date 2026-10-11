// How a printed docs source is compared with an example file's code
// (printed_source_test.ts, scripts/visual_smoke.ts): whitespace-insensitive,
// trailing-comma-insensitive, and blind to the site wrapper's name.
export function normalizeSource(code: string): string {
  return code
    .replace(/SitePlot(3D)?/g, "GGPlot")
    .replace(/,(\s*[}\]])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\s*([<>{}()[\],=])\s*/g, "$1")
    .trim();
}

/** An example file's code with its line comments removed, normalized. */
export function normalizeFile(text: string): string {
  return normalizeSource(text.replace(/^\s*\/\/.*$/gm, ""));
}

/** The example modules whose charts the docs print. */
export const EXAMPLE_FILES = [
  "examples_basics.tsx",
  "examples_stats.tsx",
  "geom_examples_intervals.tsx",
  "geom_examples_shapes.tsx",
  "example_3d.tsx",
  "compose_example.tsx",
] as const;
