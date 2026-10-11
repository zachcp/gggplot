// The doc site's chart fonts, one set per host: the 2D and 3D scenes each load
// their own. Kept apart from the canvas hosts so a chart module (site_plot.tsx)
// reaches its fonts without importing a WebGPU host.
import { createFontResources } from "@gggplot/core";
import { assetUrl } from "./asset_url.ts";

const faces = () => [
  {
    family: "Basic",
    weight: 400,
    style: "normal" as const,
    src: assetUrl("/fonts/Basic-Regular.ttf"),
  },
  {
    family: "Lato",
    weight: 400,
    style: "normal" as const,
    src: assetUrl("/fonts/Lato-Regular.ttf"),
  },
];

/** The 2D scene's fonts (scene.tsx). */
export const fontResources = createFontResources(faces());

/** The 3D scene's fonts (scene3d.tsx). */
export const fontResources3d = createFontResources(faces());
