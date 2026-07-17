import type { GGSpec } from "@gggplot/core";

/** Apply readable host defaults without overriding an example's explicit theme. */
export function withSiteChartTheme(spec: GGSpec): GGSpec {
  return {
    ...spec,
    theme: {
      fontFamily: "sans-serif",
      textColor: "#e5e7eb",
      axisColor: "#a8adbd",
      gridColor: "#343447",
      ...spec.theme,
    },
  };
}
