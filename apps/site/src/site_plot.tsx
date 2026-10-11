/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// The doc site's component-form <GGPlot>: the site's dark-canvas theme and
// loaded fonts, so a component example's source shows only its grammar. An
// example's own theme props and <Theme*> parts still win, as with
// withSiteChartTheme for specs.
import * as Jsx from "@gggplot/core/jsx";
import type { LiveElement } from "@use-gpu/live";
import { GGPlot, type GGPlotComponentProps } from "@gggplot/core";
import { SITE_CHART_THEME } from "./chart_theme.ts";
import { fontResources } from "./scene.tsx";

export function SitePlot(
  props: Omit<GGPlotComponentProps, "fontResources" | "fonts">,
): LiveElement {
  return (
    <GGPlot
      {...props}
      theme={{ ...SITE_CHART_THEME, ...props.theme }}
      fontResources={fontResources}
    />
  );
}
