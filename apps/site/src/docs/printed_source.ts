// The source a docs panel shows for an example: its chart printed as JSX
// (printJsx, gggplot-vnh.11), after any prelude it depends on. Browser-side:
// the compose example's custom primitive imports Workbench by name, which
// Deno cannot load (print_names.ts covers the rest for the Deno test).
import { printJsx } from "@gggplot/core";
import type { LiveElement } from "@use-gpu/live";
import * as compose from "./compose_example.tsx";
import { docPrintOptions } from "./print_names.ts";

let options: ReturnType<typeof docPrintOptions> | null = null;
const printed = new WeakMap<object, string>();

/** The printed source of `example`, computed once. */
export function printedSource(
  example: { chart: () => LiveElement; sourcePrelude?: string },
): string {
  let source = printed.get(example);
  if (source === undefined) {
    options ??= docPrintOptions(compose);
    const jsx = printJsx(example.chart(), options).source;
    source = example.sourcePrelude ? `${example.sourcePrelude}\n\n${jsx}` : jsx;
    printed.set(example, source);
  }
  return source;
}
