import { assertEquals } from "@std/assert";
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

  // Scan every DocExample source module in this directory, not just the two
  // barrels, so the coverage check keeps working as example files are split.
  const docsDir = new URL("./", import.meta.url);
  const sourceNames: string[] = [];
  for await (const entry of Deno.readDir(docsDir)) {
    if (entry.isFile && entry.name.endsWith(".tsx")) {
      sourceNames.push(entry.name);
    }
  }
  sourceNames.sort();
  const sources = await Promise.all(
    sourceNames.map((name) => Deno.readTextFile(new URL(name, docsDir))),
  );
  const ids = sources.flatMap((source) =>
    [...source.matchAll(/\bid:\s*"([A-Z][A-Za-z0-9]+)"/g)].map((match) =>
      match[1]
    )
  );
  assertEquals(new Set(ids).size, ids.length, "DocExample ids must be unique");
  // The 3D page renders ThreeDShowcase entries, not DocExamples, so those ids
  // are declared in example_3d.ts rather than in a .tsx source. geomSurface
  // and geomVoxel have no 2D form and are documented only this way.
  //
  // Read as source, not imported: example_3d.ts calls compile(), which pulls
  // in @use-gpu/plot, a browser-only module that fails to load under Deno.
  // The DocExample scan above already works this way.
  const showcaseSource = await Deno.readTextFile(
    new URL("./example_3d.ts", import.meta.url),
  );
  const showcaseVars = new Map<string, string>();
  for (
    const match of showcaseSource.matchAll(
      /const\s+(\w+)\s*=\s*showcase\(\s*"([A-Z][A-Za-z0-9]*)"/g,
    )
  ) {
    showcaseVars.set(match[2], match[1]);
  }
  // Declaring a showcase is not enough; it must also be in the exported array
  // the 3D page renders.
  const listed = new Set(
    (showcaseSource.match(
      /export const threeDShowcases[^=]*=\s*\[([\s\S]*?)\]/,
    )?.[1] ?? "").match(/\b\w+\b/g) ?? [],
  );
  const showcaseIds = new Set(
    [...showcaseVars].filter(([, variable]) => listed.has(variable))
      .map(([id]) => id),
  );
  assertEquals(
    showcaseIds.size > 0,
    true,
    "no ThreeDShowcase ids found in example_3d.ts",
  );
  const known = new Set([...ids, ...showcaseIds]);
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
      if (coverage.mode === "threeD") {
        if (!showcaseIds.has(id)) {
          throw new Error(
            `${constructor} references missing 3D showcase ${id}`,
          );
        }
        continue;
      }
      const declaration = declarations.get(id);
      if (!declaration || !pageExamples.has(declaration)) {
        throw new Error(`${constructor} example ${id} is not on a docs page`);
      }
    }
  }
});
