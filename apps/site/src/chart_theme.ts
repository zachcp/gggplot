import type { GGSpec } from "@gggplot/core";

/** The dark-canvas palette both the 2D and 3D hosts hand their charts. */
const SITE_CHART_COLORS = {
  textColor: "#e5e7eb",
  axisColor: "#a8adbd",
  gridColor: "#343447",
};

/** Apply readable host defaults without overriding an example's explicit theme. */
export function withSiteChartTheme(spec: GGSpec): GGSpec {
  return {
    ...spec,
    theme: { fontFamily: "Basic", ...SITE_CHART_COLORS, ...spec.theme },
  };
}

/**
 * Same palette for a 3D spec: 3D reads the SAME Theme keys as 2D
 * (gggplot-4q2.10/.11), and needs them for the same reason — without a host
 * theme the guide text falls back to near-black, invisible on this canvas.
 *
 * No `fontFamily`, deliberately. The 2D host loads Basic/Lato through
 * `createFontResources` and hands them to GGPlot's FontLoader; the 3D scene
 * mounts a bare FontLoader, so naming a family it has not loaded would ask for
 * a face that does not exist. The default face renders fine.
 */
export function withSiteChartTheme3d(spec: GGSpec): GGSpec {
  return {
    ...spec,
    theme: { ...SITE_CHART_COLORS, ...spec.theme },
  };
}
