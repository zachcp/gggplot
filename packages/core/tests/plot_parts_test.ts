// gggplot-vnh.7.1: each plot-part component reports the part its DSL
// constructor builds.
import { assertEquals, assertThrows } from "@std/assert";
import * as dsl from "../src/dsl/mod.ts";
import type { SpecPart } from "../src/dsl/base.ts";
import * as parts from "../src/components/plot_parts.ts";
import type { PartComponent } from "../src/components/plot_parts.ts";
import type { FacetGrid as PublicFacetGrid } from "../src/mod.ts";

// deno-lint-ignore no-explicit-any
type AnyPart = PartComponent<any>;
type Opts = Record<string, unknown>;

const SCALES: Array<[AnyPart, (opts: Opts) => SpecPart]> = [
  [parts.ScaleXContinuous, dsl.scaleXContinuous],
  [parts.ScaleYContinuous, dsl.scaleYContinuous],
  [parts.ScaleZContinuous, dsl.scaleZContinuous],
  [parts.ScaleXDiscrete, dsl.scaleXDiscrete],
  [parts.ScaleYDiscrete, dsl.scaleYDiscrete],
  [parts.ScaleZDiscrete, dsl.scaleZDiscrete],
  [parts.ScaleXLog10, dsl.scaleXLog10],
  [parts.ScaleYLog10, dsl.scaleYLog10],
  [parts.ScaleZLog10, dsl.scaleZLog10],
  [parts.ScaleXSqrt, dsl.scaleXSqrt],
  [parts.ScaleYSqrt, dsl.scaleYSqrt],
  [parts.ScaleZSqrt, dsl.scaleZSqrt],
  [parts.ScaleColor, dsl.scaleColor],
  [parts.ScaleFill, dsl.scaleFill],
  [parts.ScaleColorViridis, dsl.scaleColorViridis],
  [parts.ScaleFillViridis, dsl.scaleFillViridis],
  [parts.ScaleColorGradient2, dsl.scaleColorGradient2],
  [parts.ScaleFillGradient2, dsl.scaleFillGradient2],
  [parts.ScaleSize, dsl.scaleSize],
  [parts.ScaleAlpha, dsl.scaleAlpha],
  [parts.ScaleShape, dsl.scaleShape],
  [parts.ScaleLinetype, dsl.scaleLinetype],
  [parts.ScaleLinewidth, dsl.scaleLinewidth],
  [parts.ScaleStroke, dsl.scaleStroke],
];

const THEMES: Array<[AnyPart, () => SpecPart]> = [
  [parts.ThemeMinimal, dsl.themeMinimal],
  [parts.ThemeClassic, dsl.themeClassic],
  [parts.ThemeGrey, dsl.themeGrey],
  [parts.ThemeBw, dsl.themeBw],
  [parts.ThemeLinedraw, dsl.themeLinedraw],
  [parts.ThemeLight, dsl.themeLight],
  [parts.ThemeDark, dsl.themeDark],
  [parts.ThemeVoid, dsl.themeVoid],
  [parts.ThemeTest, dsl.themeTest],
];

Deno.test("scales match the DSL", () => {
  const optionSets: Opts[] = [
    {},
    { name: "Weight", domain: [0, 10], breaks: [0, 5, 10] },
    { range: ["#000000", "#ffffff"], guide: dsl.guideColorbar() },
    { kind: "discrete" },
  ];
  for (const [component, construct] of SCALES) {
    for (const opts of optionSets) {
      assertEquals(component.part(opts), construct(opts));
    }
  }
});

Deno.test("themes, labels and theme overrides match the DSL", () => {
  for (const [component, construct] of THEMES) {
    assertEquals(component.part({}), construct());
  }
  // A preset's props merge over it, as preset + theme(...) does in the DSL.
  assertEquals(parts.ThemeMinimal.part({ fontSize: 14 }).value, {
    ...dsl.themeMinimal().value,
    ...dsl.theme({ fontSize: 14 }).value,
  });
  assertEquals(
    parts.ThemeOverrides.part({ gridColor: "#eee" }),
    dsl.theme({ gridColor: "#eee" }),
  );
  assertEquals(
    parts.Labs.part({ title: "T", x: "X" }),
    dsl.labels({ title: "T", x: "X" }),
  );
});

Deno.test("coords match the DSL", () => {
  assertEquals(parts.CoordCartesian.part({}), dsl.coordCartesian());
  assertEquals(
    parts.CoordCartesian.part({ ylim: [0, 60], axes: "xzy" }),
    dsl.coordCartesian({ ylim: [0, 60], axes: "xzy" }),
  );
  assertEquals(
    parts.CoordCartesian.part({ xlim: [1, 2], params: { custom: 1 } }),
    dsl.coordCartesian({ xlim: [1, 2], custom: 1 }),
  );
  assertThrows(() => parts.CoordCartesian.part({ xlim: [2, 1] }), RangeError);
  assertEquals(parts.CoordPolar.part({}), dsl.coordPolar());
  assertEquals(
    parts.CoordPolar.part({ theta: "y", start: 1 }),
    dsl.coordPolar({ theta: "y", start: 1 }),
  );
  assertEquals(parts.CoordRadial.part({}), dsl.coordRadial());
  assertEquals(
    parts.CoordRadial.part({ donut: 0.4, end: Math.PI, theta: "y" }),
    dsl.coordRadial({ donut: 0.4, end: Math.PI, theta: "y" }),
  );
  assertEquals(parts.CoordFixed.part({}), dsl.coordFixed());
  assertEquals(parts.CoordFixed.part({ ratio: 2 }), dsl.coordFixed(2));
  assertEquals(parts.CoordFlip.part({}), dsl.coordFlip());
});

Deno.test("facets, camera and execution match the DSL", () => {
  assertEquals(
    parts.FacetWrap.part({ vars: ["g"] }),
    dsl.facetWrap(["g"]),
  );
  assertEquals(
    parts.FacetWrap.part({ vars: ["g", "h"], ncol: 2, scales: "free_y" }),
    dsl.facetWrap(["g", "h"], 2, "free_y"),
  );
  assertEquals(
    parts.FacetGrid.part({ rows: ["a"], cols: ["b"], scales: "free" }),
    dsl.facetGrid(["a"], ["b"], "free"),
  );
  assertEquals(parts.Camera3d.part({}), dsl.camera3d());
  assertEquals(
    parts.Camera3d.part({ bearing: 0.5 }),
    dsl.camera3d({ bearing: 0.5 }),
  );
  const bounds = { min: [0, 0, 0], max: [1, 2, 3] } as never;
  assertEquals(
    parts.Camera3dFit.part({ bounds }),
    dsl.camera3dFit(bounds),
  );
  assertEquals(
    parts.Execution.part({ resident: false }),
    dsl.execution({ resident: false }),
  );
});

Deno.test("Live's key and children are not part options", () => {
  assertEquals(
    parts.ScaleXLog10.part(
      { key: undefined, children: [], name: "x" } as never,
    ),
    dsl.scaleXLog10({ name: "x" }),
  );
});

Deno.test("the public FacetGrid is the plot part, not the renderer's layout", () => {
  // Checked by the type checker: an explicit renderer export used to shadow
  // the plot part's `export *` (importing mod.ts at runtime would load the
  // renderer, which Deno cannot).
  const publicPart: typeof PublicFacetGrid = parts.FacetGrid;
  const plotPart: typeof parts.FacetGrid =
    null as unknown as typeof PublicFacetGrid;
  assertEquals(typeof publicPart.part, "function");
  assertEquals(plotPart, null);
});
