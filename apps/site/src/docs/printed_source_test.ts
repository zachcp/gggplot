// gggplot-vnh.11: what a docs panel shows is printJsx's print of the example's
// live `chart`. The print must be the chart's own code: whitespace-normalized,
// with <SitePlot> as <GGPlot>, it appears in the file outside comments. That
// code type-checks with the site and draws the golden frame (test:goldens),
// so the shown source does too.
//
// The compose example is checked in the browser instead (visual_smoke.ts): its
// custom primitive imports Workbench by name, which Deno cannot load.
import { assert, assertEquals } from "@std/assert";
import { printJsx } from "@gggplot/core";
import type { LiveElement } from "@use-gpu/live";
import { docPrintOptions } from "./print_names.ts";
import { normalizeFile, normalizeSource } from "./source_normalize.ts";
import * as basics from "./examples_basics.tsx";
import * as stats from "./examples_stats.tsx";
import * as intervals from "./geom_examples_intervals.tsx";
import * as shapes from "./geom_examples_shapes.tsx";
import * as threeD from "./example_3d.tsx";

const FILES: [string, Record<string, unknown>][] = [
  ["examples_basics.tsx", basics],
  ["examples_stats.tsx", stats],
  ["geom_examples_intervals.tsx", intervals],
  ["geom_examples_shapes.tsx", shapes],
  ["example_3d.tsx", threeD],
];

const options = docPrintOptions();

type Example = { id: string; chart: () => LiveElement };

/** A module's examples: exported one by one, or in an exported list. */
function examplesOf(module: Record<string, unknown>): Example[] {
  return Object.values(module).flatMap((value) =>
    Array.isArray(value) ? value : [value]
  ).filter((value): value is Example =>
    !!value && typeof value === "object" && "chart" in value
  );
}

for (const [file, module] of FILES) {
  Deno.test(`every chart in ${file} prints as its own code`, async () => {
    const text = await Deno.readTextFile(new URL(file, import.meta.url));
    const code = normalizeFile(text);
    const examples = examplesOf(module);
    assert(examples.length > 0, `${file} has examples`);
    const missing = examples.filter((example) => {
      const printed = printJsx(example.chart(), options);
      return !code.includes(normalizeSource(printed.source));
    }).map((example) => example.id);
    assertEquals(missing, [], `printed source not found in ${file}'s code`);
  });
}

Deno.test("every name a printed source reads is exported", () => {
  // A name the printer had to invent (the prop's own name) means the value is
  // not exported where print_names.ts can see it.
  const exported = new Set(options.refs!.values());
  for (const [, module] of FILES) {
    for (const example of examplesOf(module)) {
      const { references } = printJsx(example.chart(), options);
      const invented = references.filter((ref) => !exported.has(ref));
      assertEquals(invented, [], `${example.id} reads unexported names`);
    }
  }
});

Deno.test("no example file imports the DSL", async () => {
  const DSL =
    /\b(ggplot|geom[A-Z]\w*|scale[A-Z]\w*|coord[A-Z]\w*|facet[A-Z]\w*|theme[A-Z]?\w*|stat[A-Z]\w*)\(/;
  for (const [file] of FILES) {
    const text = await Deno.readTextFile(new URL(file, import.meta.url));
    const hit = text.replace(/\/\/.*$/gm, "").match(DSL);
    assertEquals(hit?.[0], undefined, `${file} calls the DSL`);
  }
});
