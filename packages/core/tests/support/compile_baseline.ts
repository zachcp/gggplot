// compile()'s output, frozen (gggplot-qs9b). The component root was built to
// reproduce compile()'s tree for facets, coords, 3D and diagnostics; these
// baselines, captured from compile() before it was retired, keep that parity
// checked without the code. Like the doc site's golden frames (w8zq): the old
// path's answer, saved, is the reference the new path must keep matching.
import { assertEquals } from "@std/assert";
import { serializeTypedArrays } from "../../../../scripts/capture_geom_fixtures.ts";

const DIR = new URL("../fixtures/compile_parity/", import.meta.url);

const serialize = (value: unknown) =>
  JSON.stringify(value, serializeTypedArrays, 1);

/**
 * Assert `actual` (a plain, key-free tree or value) equals compile()'s saved
 * answer for `name`. With GGG_CAPTURE_COMPILE_BASELINES=1 and `compiled`
 * given, writes that answer instead.
 */
export function assertCompileBaseline(
  name: string,
  actual: unknown,
  compiled?: unknown,
): void {
  const file = new URL(`${name}.json`, DIR);
  if (
    compiled !== undefined &&
    Deno.env.get("GGG_CAPTURE_COMPILE_BASELINES") === "1"
  ) {
    Deno.writeTextFileSync(file, serialize(compiled) + "\n");
  }
  const saved = Deno.readTextFileSync(file).trimEnd();
  assertEquals(
    serialize(actual),
    saved,
    `the component path no longer matches compile()'s saved ${name}`,
  );
}

/**
 * compile()'s saved answer for `name`, parsed (typed arrays come back as plain
 * number arrays). With GGG_CAPTURE_COMPILE_BASELINES=1 and `compiled` given,
 * writes that answer first.
 */
export function compileBaseline<T>(name: string, compiled?: () => T): T {
  const file = new URL(`${name}.json`, DIR);
  if (compiled && Deno.env.get("GGG_CAPTURE_COMPILE_BASELINES") === "1") {
    Deno.writeTextFileSync(file, serialize(compiled()) + "\n");
  }
  return JSON.parse(Deno.readTextFileSync(file));
}

/** A test name as a baseline file name. */
export const baselineName = (group: string, name: string) =>
  `${group}/${
    name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
  }`;
