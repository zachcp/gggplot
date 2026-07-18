import { assertEquals } from "jsr:@std/assert@1";
import * as geomDsl from "../../../../packages/core/src/dsl/geoms.ts";
import { geomExampleCoverage } from "./geom_coverage.ts";

Deno.test("every public geom constructor has a live documentation example", async () => {
  const constructors = Object.entries(geomDsl)
    .filter(([name, value]) =>
      /^geom[A-Z]/.test(name) && typeof value === "function"
    )
    .map(([name]) => name)
    .sort();
  assertEquals(Object.keys(geomExampleCoverage).sort(), constructors);

  const sources = await Promise.all([
    Deno.readTextFile(new URL("./examples.tsx", import.meta.url)),
    Deno.readTextFile(new URL("./geom_examples.tsx", import.meta.url)),
  ]);
  const ids = sources.flatMap((source) =>
    [...source.matchAll(/\bid:\s*"([A-Z][A-Za-z0-9]+)"/g)].map((match) =>
      match[1]
    )
  );
  assertEquals(new Set(ids).size, ids.length, "DocExample ids must be unique");
  const known = new Set(ids);
  const declarations = new Map<string, string>();
  for (const source of sources) {
    for (
      const match of source.matchAll(
        /export const\s+(\w+)\s*:\s*DocExample\s*=\s*\{\s*id:\s*"([A-Z][A-Za-z0-9]+)"/g,
      )
    ) {
      declarations.set(match[2], match[1]);
    }
  }
  const pagesSource = await Deno.readTextFile(
    new URL("./pages.ts", import.meta.url),
  );
  const pageExamples = new Set(
    [...pagesSource.matchAll(/examples:\s*\[([\s\S]*?)\]/g)]
      .flatMap((match) => match[1].match(/\b[A-Za-z]\w*\b/g) ?? []),
  );
  for (const [constructor, coverage] of Object.entries(geomExampleCoverage)) {
    if (coverage.exampleIds.length === 0) {
      throw new Error(`${constructor} has no documentation example`);
    }
    for (const id of coverage.exampleIds) {
      if (!known.has(id)) {
        throw new Error(`${constructor} references missing example ${id}`);
      }
      const declaration = declarations.get(id);
      if (!declaration || !pageExamples.has(declaration)) {
        throw new Error(`${constructor} example ${id} is not on a docs page`);
      }
    }
  }
});
