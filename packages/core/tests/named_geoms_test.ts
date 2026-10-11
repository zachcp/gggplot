// gggplot-8hz: each named geom component builds the layer its DSL
// constructor builds, from the same options.
import { assertEquals } from "@std/assert";
import * as dsl from "../src/dsl/mod.ts";
import type { SpecPart } from "../src/dsl/base.ts";
import { layerFromProps } from "../src/components/geom_layer.ts";
import * as geoms from "../src/components/geoms.ts";
import type { NamedGeom } from "../src/components/geoms.ts";
import { asFactor } from "../src/data/mod.ts";
import { GEOM_REGISTRY } from "../src/geom/mod.ts";

type Opts = Record<string, unknown>;
// deno-lint-ignore no-explicit-any
type AnyGeom = NamedGeom<any>;

/** The DSL constructor each component mirrors, by component name. */
const PAIRS: Array<[string, AnyGeom, (opts: Opts) => SpecPart]> = [
  ["GeomPoint", geoms.GeomPoint, dsl.geomPoint],
  ["GeomLine", geoms.GeomLine, dsl.geomLine],
  ["GeomPath", geoms.GeomPath, dsl.geomPath],
  ["GeomStep", geoms.GeomStep, dsl.geomStep],
  ["GeomBar", geoms.GeomBar, dsl.geomBar],
  ["GeomHistogram", geoms.GeomHistogram, dsl.geomHistogram],
  ["GeomCol", geoms.GeomCol, dsl.geomCol],
  ["GeomArea", geoms.GeomArea, dsl.geomArea],
  ["GeomRibbon", geoms.GeomRibbon, dsl.geomRibbon],
  ["GeomPolygon", geoms.GeomPolygon, dsl.geomPolygon],
  ["GeomTile", geoms.GeomTile, dsl.geomTile],
  ["GeomRaster", geoms.GeomRaster, dsl.geomRaster],
  ["GeomRect", geoms.GeomRect, dsl.geomRect],
  ["GeomText", geoms.GeomText, dsl.geomText],
  ["GeomLabel", geoms.GeomLabel, dsl.geomLabel],
  ["GeomBoxplot", geoms.GeomBoxplot, dsl.geomBoxplot],
  ["GeomViolin", geoms.GeomViolin, dsl.geomViolin],
  ["GeomDotplot", geoms.GeomDotplot, dsl.geomDotplot],
  ["GeomErrorbar", geoms.GeomErrorbar, dsl.geomErrorbar],
  ["GeomErrorbarh", geoms.GeomErrorbarh, dsl.geomErrorbarh],
  ["GeomLinerange", geoms.GeomLinerange, dsl.geomLinerange],
  ["GeomPointrange", geoms.GeomPointrange, dsl.geomPointrange],
  ["GeomCrossbar", geoms.GeomCrossbar, dsl.geomCrossbar],
  ["GeomSmooth", geoms.GeomSmooth, dsl.geomSmooth],
  ["GeomDensity", geoms.GeomDensity, dsl.geomDensity],
  ["GeomFreqpoly", geoms.GeomFreqpoly, dsl.geomFreqpoly],
  ["GeomBin2d", geoms.GeomBin2d, dsl.geomBin2d],
  ["GeomHex", geoms.GeomHex, dsl.geomHex],
  ["GeomWaffle", geoms.GeomWaffle, dsl.geomWaffle],
  ["GeomQq", geoms.GeomQq, dsl.geomQq],
  ["GeomQqLine", geoms.GeomQqLine, dsl.geomQqLine],
  ["GeomSegment", geoms.GeomSegment, dsl.geomSegment],
  ["GeomCurve", geoms.GeomCurve, dsl.geomCurve],
  ["GeomSpoke", geoms.GeomSpoke, dsl.geomSpoke],
  ["GeomRug", geoms.GeomRug, dsl.geomRug],
  ["GeomContour", geoms.GeomContour, dsl.geomContour],
  ["GeomContourFilled", geoms.GeomContourFilled, dsl.geomContourFilled],
  ["GeomDensity2d", geoms.GeomDensity2d, dsl.geomDensity2d],
  ["GeomDensity2dFilled", geoms.GeomDensity2dFilled, dsl.geomDensity2dFilled],
  ["GeomQuantile", geoms.GeomQuantile, dsl.geomQuantile],
  ["GeomEcdf", geoms.GeomEcdf, dsl.geomEcdf],
  ["GeomJitter", geoms.GeomJitter, dsl.geomJitter],
  ["GeomCount", geoms.GeomCount, dsl.geomCount],
  ["GeomBlank", geoms.GeomBlank, dsl.geomBlank],
  ["GeomSurface", geoms.GeomSurface, dsl.geomSurface],
  ["GeomVoxel", geoms.GeomVoxel, dsl.geomVoxel],
  ["StatSum", geoms.StatSum, dsl.statSum],
  ["StatWaffle", geoms.StatWaffle, dsl.statWaffle],
  ["StatSummary2d", geoms.StatSummary2d, dsl.statSummary2d],
  ["StatSummaryHex", geoms.StatSummaryHex, dsl.statSummaryHex],
  ["StatSummaryBin", geoms.StatSummaryBin, dsl.statSummaryBin],
  ["StatEllipse", geoms.StatEllipse, dsl.statEllipse],
  ["StatConnect", geoms.StatConnect, dsl.statConnect],
  ["StatAlign", geoms.StatAlign, dsl.statAlign],
  ["StatDensity2d", geoms.StatDensity2d, dsl.statDensity2d],
  ["StatDensity2dFilled", geoms.StatDensity2dFilled, dsl.statDensity2dFilled],
  ["StatQuantile", geoms.StatQuantile, dsl.statQuantile],
  ["StatEcdf", geoms.StatEcdf, dsl.statEcdf],
  ["StatUnique", geoms.StatUnique, dsl.statUnique],
];

/** The layer a component builds from `props`. */
const componentLayer = (component: AnyGeom, props: Opts) =>
  layerFromProps(component.layerProps(props));

const OPTION_SETS: Opts[] = [
  {},
  { color: "red", size: 3, opacity: 0.5 },
  { mapping: { x: "a", y: "b" }, inheritAes: false, bins: 7 },
  { stat: "identity", position: "dodge", width: 0.4 },
  {
    data: { a: [1, 2], g: ["b", "a"] },
    dataOptions: { columns: { g: asFactor(["b", "a"]) } },
  },
  { mapping: { size: "w", color: "q" } },
];

Deno.test("every named geom builds its DSL constructor's layer", () => {
  for (const [name, component, construct] of PAIRS) {
    for (const opts of OPTION_SETS) {
      assertEquals(
        componentLayer(component, opts),
        construct(opts).value,
        `${name} ${JSON.stringify(opts)}`,
      );
    }
  }
});

Deno.test("`params` passes untyped parameters through", () => {
  assertEquals(
    componentLayer(geoms.GeomPoint, {
      stat: "summary",
      params: { fun: "max" },
    }),
    dsl.geomPoint({ stat: "summary", fun: "max" }).value,
  );
});

Deno.test("function and literal layers match the DSL", () => {
  const fun = (x: number) => x * x;
  assertEquals(
    componentLayer(geoms.GeomFunction, { fun, n: 20 }),
    dsl.geomFunction(fun, { n: 20 }).value,
  );
  assertEquals(
    componentLayer(geoms.GeomHline, { yintercept: [1, 2], color: "red" }),
    dsl.geomHline({ yintercept: [1, 2], color: "red" }).value,
  );
  assertEquals(
    componentLayer(geoms.GeomVline, { xintercept: 3 }),
    dsl.geomVline({ xintercept: 3 }).value,
  );
  assertEquals(
    componentLayer(geoms.GeomAbline, { slope: 2, intercept: 1 }),
    dsl.geomAbline({ slope: 2, intercept: 1 }).value,
  );
  assertEquals(
    componentLayer(geoms.Annotate, {
      geom: "text",
      x: 1,
      y: 2,
      label: "hi",
      size: 4,
    }),
    dsl.annotate("text", { x: 1, y: 2, label: "hi", size: 4 }).value,
  );
});

Deno.test("every registry geom has a named component", () => {
  const covered = new Set(
    PAIRS.map(([, component]) => componentLayer(component, {}).geom),
  );
  for (const literal of [geoms.GeomHline, geoms.GeomVline, geoms.GeomAbline]) {
    covered.add(
      componentLayer(literal, { yintercept: 0, xintercept: 0 }).geom,
    );
  }
  assertEquals(
    Object.keys(GEOM_REGISTRY).filter((geom) => !covered.has(geom as never)),
    [],
  );
});
