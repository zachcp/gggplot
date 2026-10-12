/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// The shipped typed Live JSX surface (gggplot-vnh.2, -05w). Props on gggplot
// components are checked under `deno check`, in JSX and through the plain
// createElement form alike. The wrong-prop lines are expected errors, so the
// check fails if either ever type-checks. Part of `deno task check`.
import type { LiveElement } from "@use-gpu/live";
import {
  CoordFlip,
  CoordPolar,
  FacetWrap,
  GeomHline,
  GeomPoint,
  GeomSmooth,
  GGPlot,
  Labs,
  ScaleXLog10,
  ThemeMinimal,
} from "@gggplot/core";
import * as Jsx from "@gggplot/core/jsx";

export function UserPlot(
  { data }: { data: Record<string, number[]> },
): LiveElement {
  return <GGPlot data={data} mapping={{ x: "x" }} />;
}

// @ts-expect-error GGPlot has no `wrongProp` prop; this must not type-check.
export const wrongProp = <GGPlot mapping={{ x: "x" }} wrongProp={1} />;

// Without JSX: the same check, for plain .ts callers.
export const viaFactory: LiveElement = Jsx.createElement(GGPlot, {
  mapping: { x: "wt" },
});
// @ts-expect-error GGPlot has no `wrongProp` prop.
export const wrongViaFactory = Jsx.createElement(GGPlot, {
  mapping: { x: "wt" },
  wrongProp: 1,
});
// There is no spec form (gggplot-vnh.18): a GGSpec is not a GGPlot prop.
// @ts-expect-error GGPlot takes components, not a `spec`.
export const specForm = Jsx.createElement(GGPlot, { spec: {} });

// Named geoms (gggplot-8hz): props are typed per geom family.
export function ComponentPlot(): LiveElement {
  return (
    <GGPlot data={{ x: [1, 2], y: [3, 4] }} mapping={{ x: "x", y: "y" }}>
      <GeomPoint size={3} color="#0f766e" opacity={0.6} />
      <GeomSmooth method="loess" se={false} span={0.75} />
      <GeomHline yintercept={3.5} linetype="dashed" />
      <ScaleXLog10 name="Dose" />
      <CoordFlip />
      <FacetWrap vars={["g"]} ncol={2} />
      <ThemeMinimal fontSize={12} />
      <Labs title="Response" />
    </GGPlot>
  );
}
// @ts-expect-error GeomPoint reads no `bins`; that is a stat_bin parameter.
export const wrongGeomProp = <GeomPoint bins={3} />;
// @ts-expect-error `size` is a number.
export const wrongGeomValue = <GeomPoint size="big" />;
// Plot parts (gggplot-vnh.7.1) are typed too.
// @ts-expect-error FacetWrap needs `vars`.
export const facetWithoutVars = <FacetWrap ncol={2} />;
// @ts-expect-error theta is "x" or "y".
export const polarOnZ = <CoordPolar theta="z" />;
// A parameter the component does not type goes through `params`.
export const untypedParam = (
  <GeomPoint
    stat="summary"
    params={{ fun: "max" }}
  />
);
