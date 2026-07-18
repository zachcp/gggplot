import { assertEquals } from "jsr:@std/assert@1";
import * as geomDsl from "../../../../packages/core/src/dsl/geoms.ts";
import { GEOM_REGISTRY } from "../../../../packages/core/src/geom/mod.ts";
import type { GeomKind } from "../../../../packages/core/src/ir/types.ts";
import { geomConstructorKinds, geomExampleCoverage } from "./geom_coverage.ts";
import { geomReferenceEntries } from "./geom_reference.ts";

Deno.test("every public geom constructor has a live documentation example", async () => {
  const constructors = Object.entries(geomDsl)
    .filter(([name, value]) =>
      /^geom[A-Z]/.test(name) && typeof value === "function"
    )
    .map(([name]) => name)
    .sort();
  assertEquals(Object.keys(geomExampleCoverage).sort(), constructors);
  assertEquals(Object.keys(geomConstructorKinds).sort(), constructors);

  for (const constructor of constructors) {
    const kind = geomConstructorKinds[
      constructor as keyof typeof geomConstructorKinds
    ] as GeomKind;
    const definition = GEOM_REGISTRY[kind];
    assertEquals(
      definition.doc.summary.trim().length > 0,
      true,
      `${constructor} needs a summary`,
    );
    assertEquals(Array.isArray(definition.doc.aesthetics.required), true);
    assertEquals(Array.isArray(definition.doc.aesthetics.optional), true);
    JSON.stringify(definition.doc);

    const fn = geomDsl[constructor as keyof typeof geomDsl] as (
      ...args: unknown[]
    ) => { value: { stat: string; position: string } };
    const part = constructor === "geomFunction"
      ? fn((x: number) => x)
      : constructor === "geomHline"
      ? fn({ yintercept: 0 })
      : constructor === "geomVline"
      ? fn({ xintercept: 0 })
      : fn();
    const reference = geomReferenceEntries.find((entry) =>
      entry.constructor === constructor
    );
    assertEquals(
      reference?.defaultStat,
      part.value.stat,
      `${constructor} default stat drift`,
    );
    assertEquals(
      reference?.defaultPosition,
      part.value.position,
      `${constructor} default position drift`,
    );
  }

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
  for (const reference of geomReferenceEntries) {
    for (const id of reference.exampleIds) {
      if (!known.has(id)) {
        throw new Error(
          `${reference.constructor} reference links missing example ${id}`,
        );
      }
    }
  }
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
