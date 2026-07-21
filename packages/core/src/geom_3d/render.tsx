/** @jsxRuntime classic */
/** @jsx createElement */
// Live use.gpu render for a lowered 3D node. Wiring (from the use.gpu Cartesian
// source + plot/3d.tsx example): FontLoader → Plot → Cartesian(range) → Point,
// under the host's OrbitCamera. FontLoader satisfies Plot's SDFFontProvider;
// Cartesian maps the data range → [-1,1] cube (MatrixContext) and gives Point
// the Range/Transform context it needs; OrbitCamera projects to screen.
// Positions are handed over as nested vec3/vec4 arrays (the shape use.gpu's
// plot marks take directly), staying in data space — projection is on the GPU.
import { createElement } from "@use-gpu/live";
import { Cartesian, Plot, Point } from "@use-gpu/plot";
import { FontLoader } from "@use-gpu/workbench";
import { parseColorRGBA } from "../color/mod.ts";
import type { Render3DNode } from "./types.ts";

export const GGPlot3D = ({ node }: { node: Render3DNode }) => {
  // Flat-native: hand Point the FlatTensor OBJECTS (use.gpu source shape) with
  // an explicit vec4 positions format — no CPU expansion to nested arrays.
  const pointProps: Record<string, unknown> = {
    positions: node.positions,
    formats: { positions: "vec4<f32>" },
    size: node.size,
    opacity: node.opacity,
    depth: 1,
  };
  if (node.colors) pointProps.colors = node.colors;
  else pointProps.color = parseColorRGBA(node.color);

  return createElement(
    FontLoader,
    {},
    createElement(
      Plot,
      {},
      createElement(
        Cartesian,
        { range: node.range },
        createElement(Point, pointProps),
      ),
    ),
  );
};
