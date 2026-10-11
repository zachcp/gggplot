// gggplot-vnh.10.1: an example's shown `jsxSource` is its live `chart`'s own
// code. Checked on source text (importing the examples would load the
// renderer): each jsxSource, whitespace-normalized, must appear in the file's
// code outside the source strings, with <SitePlot> shown as <GGPlot> and a
// `"${x}"` interpolation shown as `{x}`.
import { assert, assertEquals } from "@std/assert";

const FILES = [
  "examples_basics.tsx",
  "examples_stats.tsx",
  "geom_examples_intervals.tsx",
  "geom_examples_shapes.tsx",
  "compose_example.tsx",
  "example_3d.tsx",
];

const SOURCE = /jsxSource:\s*`([\s\S]*?)`,/g;

/** Whitespace-insensitive, and blind to the site wrapper's name. */
function normalize(code: string): string {
  return code
    .replace(/SitePlot(3D)?/g, "GGPlot")
    .replace(/"\$\{(\w+)\}"/g, "{$1}")
    .replace(/\s+/g, " ")
    .replace(/\s*([<>{}()[\],=])\s*/g, "$1")
    .trim();
}

for (const file of FILES) {
  Deno.test(`every jsxSource in ${file} is its chart's code`, async () => {
    const text = await Deno.readTextFile(new URL(file, import.meta.url));
    const sources = [...text.matchAll(SOURCE)].map((m) => m[1]);
    assert(sources.length > 0, `${file} has examples`);
    const code = normalize(text.replace(SOURCE, ""));
    // A source may show several blocks (a helper, then the plot), each of
    // which must appear in the code; blank lines separate them.
    const missing = sources.flatMap((source) => source.split(/\n\s*\n/))
      .filter((block) => !code.includes(normalize(block)));
    assertEquals(missing, [], `jsxSource not found in ${file}'s code`);
  });
}

Deno.test("no example file imports the DSL", async () => {
  const DSL =
    /\b(ggplot|geom[A-Z]\w*|scale[A-Z]\w*|coord[A-Z]\w*|facet[A-Z]\w*|theme[A-Z]?\w*|stat[A-Z]\w*)\(/;
  for (const file of FILES) {
    const text = await Deno.readTextFile(new URL(file, import.meta.url));
    const code = text.replace(SOURCE, "").replace(/\/\/.*$/gm, "");
    const hit = code.match(DSL);
    assertEquals(hit?.[0], undefined, `${file} calls the DSL`);
  }
});
