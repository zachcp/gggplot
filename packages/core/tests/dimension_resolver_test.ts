import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  camera3d,
  facetWrap,
  geomBar,
  geomBoxplot,
  geomCol,
  geomBlank,
  geomPoint,
  geomTile,
  ggplot,
  statSummary2d,
} from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import {
  GEOM_REGISTRY,
  resolvePlotDimension,
  selectGeomMode,
} from "../src/geom/mod.ts";
import type { GeomDefinition } from "../src/geom/mod.ts";
import type { Layer } from "../src/ir/types.ts";

const data = { x: [1, 2], y: [3, 4], z: [5, 6], panel: ["a", "b"] };

Deno.test("dimension resolver selects shared geomPoint from its effective mapping", () => {
  const two = ggplot(data, { x: "x", y: "y" }).add(geomPoint()).build();
  assertEquals(resolvePlotDimension(two).dimensions, 2);

  const three = ggplot(data, { x: "x", y: "y", z: "z" }).add(geomPoint())
    .build();
  const resolved = resolvePlotDimension(three);
  assertEquals(resolved.dimensions, 3);
  assertEquals(resolved.layers[0].mode.requiredPosition, ["x", "y", "z"]);

  const noInherit = ggplot(data, { x: "x", y: "y", z: "z" }).add(
    geomPoint({
      inheritAes: false,
      mapping: { x: "x", y: "y" },
    }),
  ).build();
  assertEquals(resolvePlotDimension(noInherit).dimensions, 2);
});

Deno.test("a tile z value remains 2D while point z is positional", () => {
  const tile = ggplot(data, { x: "x", y: "y", z: "z" }).add(geomTile())
    .build();
  assertEquals(resolvePlotDimension(tile).dimensions, 2);

  const mixed = ggplot(data, { x: "x", y: "y", z: "z" }).add(
    geomPoint(),
    geomTile(),
  ).build();
  assertThrows(
    () => resolvePlotDimension(mixed),
    Error,
    "mixed 2D/3D layers",
  );
});

Deno.test("a mapped z with nothing to consume it fails instead of vanishing", () => {
  // Derived from the registry rather than a hardcoded list: this test broke
  // twice as geoms gained 3D modes, which is the test's own fault for naming
  // them. Any geom that declares no 3D mode, does not read z as a value
  // channel, and still contributes a dimension must reject a mapped z.
  const twoDOnly = Object.entries(GEOM_REGISTRY).filter(([, definition]) =>
    !(definition.modes ?? []).some((mode) => mode.dimensions === 3) &&
    !(definition.nonPositionalAes ?? []).includes("z") &&
    definition.contributesDimension !== false
  );
  assert(twoDOnly.length > 0, "expected some geoms to remain 2D-only");

  for (const [kind, definition] of twoDOnly) {
    const layer = {
      geom: kind,
      stat: definition.defaultStat,
      position: definition.defaultPosition ?? "identity",
      params: {},
    } as unknown as Layer;
    assertThrows(
      () => selectGeomMode(layer, { x: "x", y: "y", z: "z" }, definition),
      Error,
      "z is not supported",
      `geom_${kind} should reject a mapped z`,
    );
  }
});

Deno.test("z stays legal wherever something actually reads it", () => {
  // A stat that reduces z as a value channel.
  assertEquals(
    resolvePlotDimension(
      ggplot(data, { x: "x", y: "y", z: "z" }).add(statSummary2d({ bins: 2 }))
        .build(),
    ).dimensions,
    2,
  );
  // A geom that documents z as a value channel.
  assertEquals(
    resolvePlotDimension(
      ggplot(data, { x: "x", y: "y", z: "z" }).add(geomTile()).build(),
    ).dimensions,
    2,
  );
  // A geom that only trains scales.
  assertEquals(
    resolvePlotDimension(
      ggplot(data, { x: "x", y: "y", z: "z" }).add(geomBlank()).build(),
    ).dimensions,
    2,
  );
  // And a geom whose 3D mode takes z as a position.
  assertEquals(
    resolvePlotDimension(
      ggplot(data, { x: "x", y: "y", z: "z" }).add(geomPoint()).build(),
    ).dimensions,
    3,
  );
});

Deno.test("empty and blank-only plots default to 2D", () => {
  assertEquals(resolvePlotDimension(ggplot(data).build()).dimensions, 2);
  assertEquals(
    resolvePlotDimension(
      ggplot(data, { x: "x", y: "y", z: "z" }).add(geomBlank()).build(),
    ).dimensions,
    2,
  );
});

Deno.test("dimension resolver validates required axes, stat, position, and mode params", () => {
  assertThrows(
    () =>
      resolvePlotDimension(
        ggplot(data, { x: "x" }).add(geomPoint()).build(),
      ),
    Error,
    "requires mapped position aesthetic(s): y",
  );
  assertThrows(
    () =>
      resolvePlotDimension(
        ggplot(data, { x: "x", y: "y", z: "z" }).add(
          geomPoint({ stat: "summary" }),
        ).build(),
      ),
    Error,
    'does not support stat "summary"',
  );
  assertThrows(
    () =>
      resolvePlotDimension(
        ggplot(data, { x: "x", y: "y", z: "z" }).add(
          geomPoint({ position: "jitter" }),
        ).build(),
      ),
    Error,
    'does not support position "jitter"',
  );
  assertThrows(
    () =>
      resolvePlotDimension(
        ggplot(data, { x: "x", y: "y" }).add(
          geomPoint({ sizeMode: "constant" }),
        ).build(),
      ),
    Error,
    'does not support parameter "sizeMode"',
  );
  assertEquals(
    resolvePlotDimension(
      ggplot(data, { x: "x", y: "y", z: "z" }).add(
        geomPoint({ sizeMode: "perspective" }),
      ).build(),
    ).dimensions,
    3,
  );
  assertThrows(
    () =>
      resolvePlotDimension(
        ggplot(data, { x: "x", y: "y", z: "z" }).add(
          geomPoint({ sizeMode: "world" }),
        ).build(),
      ),
    Error,
    'parameter "sizeMode" must be one of',
  );
});

Deno.test("camera-on-2D and faceted 3D fail before lowering", () => {
  assertThrows(
    () =>
      resolvePlotDimension(
        ggplot(data, { x: "x", y: "y" }).add(geomPoint(), camera3d())
          .build(),
      ),
    Error,
    "camera3d() requires at least one 3D geom layer",
  );
  assertThrows(
    () =>
      resolvePlotDimension(
        ggplot(data, { x: "x", y: "y", z: "z" }).add(
          geomPoint(),
          facetWrap(["panel"]),
        ).build(),
      ),
    Error,
    "faceting 3D plots is not implemented",
  );
});

Deno.test("an intrinsic 3D-only definition selects its sole mode then validates z", () => {
  const layer: Layer = {
    geom: "point",
    stat: "identity",
    position: "identity",
    params: {},
  };
  const definition = {
    defaultStat: "identity",
    lower: () => [],
    doc: { summary: "test", aesthetics: { required: [], optional: [] } },
    modes: [{
      dimensions: 3,
      requiredPosition: ["x", "y", "z"],
    }],
  } satisfies GeomDefinition;
  assertEquals(
    selectGeomMode(layer, { x: "x", y: "y", z: "z" }, definition)
      .dimensions,
    3,
  );
  assertThrows(
    () => selectGeomMode(layer, { x: "x", y: "y" }, definition),
    Error,
    "requires mapped position aesthetic(s): z",
  );
});

Deno.test("compile dispatches unified 3D before any 2D fallthrough", () => {
  const spec = ggplot(data, { x: "x", y: "y", z: "z" }).add(geomPoint())
    .build();
  assertEquals(compile(spec).component, "Scene3D");
});
