// Source-emit backend — turns a RenderTree into standalone UseGPU Live .tsx
// source. This is the literal "transpiler": ggplot spec in, UseGPU JSX out.

import type { ComponentName, RenderNode } from "../compile/rendertree.ts";

const PLOT_IMPORTS: ComponentName[] = [
  "Plot",
  "Embedded",
  "Cartesian",
  "Polar",
  "Axis",
  "Grid",
  "Point",
  "Line",
  "Face",
  "Polygon",
  "Label",
];

// "FacetGrid" isn't a real @use-gpu/plot export (see rendertree.ts and
// render/GGPlot.tsx's Live implementation, which this mirrors) — when a
// faceted spec uses it, emitSource inlines this plain-JS definition plus its
// extra imports so the generated module is still standalone.
const FACET_GRID_SOURCE = `
// Not a real @use-gpu/plot export -- divides the ambient LayoutContext pixel
// rect into an nrow x ncol grid and applies a normalized PanelViewport matrix
// while all panels share the outer Embedded/Plot reconciler.
const FacetPanel = ({ children }) => createElement(Fragment, {}, children);
const FacetGrid = ({ nrow, ncol, gap = 24, stripHeight = 24, bounds = [-1, -1, 1, 1], children }) => {
  const kids = Array.isArray(children) ? children : children != null ? [children] : [];
  const [left, top, right, bottom] = useContext(LayoutContext);
  const hostWidth = Math.max(right - left, 1);
  const hostHeight = Math.max(bottom - top, 1);
  const width = hostWidth * (bounds[2] - bounds[0]) / 2;
  const height = hostHeight * (bounds[3] - bounds[1]) / 2;
  const cellWidth = Math.max(0, (width - gap * (ncol - 1)) / ncol);
  const cellHeight = Math.max(0, (height - gap * (nrow - 1)) / nrow);
  const strip = Math.min(Math.max(0, stripHeight), cellHeight);
  const cells = createElement(
    Fragment,
    {},
    ...kids.map((child, i) => {
      const row = Math.floor(i / ncol);
      const col = i % ncol;
      const x0 = col * (cellWidth + gap);
      const y0 = row * (cellHeight + gap) + strip;
      const cellBounds = [
        bounds[0] + x0 / width * (bounds[2] - bounds[0]),
        bounds[1] + y0 / height * (bounds[3] - bounds[1]),
        bounds[0] + (x0 + cellWidth) / width * (bounds[2] - bounds[0]),
        bounds[1] + (row * (cellHeight + gap) + cellHeight) / height * (bounds[3] - bounds[1]),
      ];
      return createElement(PanelViewport, { bounds: cellBounds }, child);
    }),
  );
  return cells;
};
`;

const RADIAL_VIEWPORT_SOURCE = `
// Keeps polar geometry circular inside a non-square host canvas.
const RadialViewport = ({ children }) => {
  const [left, top, right, bottom] = useContext(LayoutContext);
  const aspect = (bottom - top) / (right - left);
  const matrix = useMemo(() => new Float32Array([
    aspect, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]), [aspect]);
  const [context, combined] = useCombinedMatrixTransform(matrix);
  return provide(MatrixContext, combined, provide(TransformContext, context, children));
};
`;

const PANEL_VIEWPORT_SOURCE = `
// Insets a plot panel while labels remain in the outer normalized chart.
const PanelViewport = ({ bounds, children }) => {
  const [x0, y0, x1, y1] = bounds;
  const matrix = useMemo(() => new Float32Array([
    (x1 - x0) / 2, 0, 0, 0,
    0, (y1 - y0) / 2, 0, 0,
    0, 0, 1, 0,
    (x0 + x1) / 2, (y0 + y1) / 2, 0, 1,
  ]), [x0, y0, x1, y1]);
  const [context, combined] = useCombinedMatrixTransform(matrix);
  return provide(MatrixContext, combined, provide(TransformContext, context, children));
};
`;

const FONT_HOST_SOURCE = `
// Font URLs and readiness remain host-owned; the generated chart accepts the
// same FontResources shape as GGPlot without embedding resources in its spec.
const EmittedFontHost = ({ fontResources, children }) => {
  const [ready, error] = useAwait(
    fontResources ? async () => {
      await fontResources.ready();
      return true;
    } : null,
    [fontResources],
  );
  if (error) throw error;
  if (fontResources && !ready) return null;
  return fontResources
    ? createElement(FontLoader, { fonts: fontResources.faces }, children)
    : children;
};
`;

function formatProp(key: string, value: unknown): string {
  if (typeof value === "string") return `${key}=${JSON.stringify(value)}`;
  return `${key}={${JSON.stringify(value)}}`;
}

function emitNode(n: RenderNode, indent: string): string {
  const props = Object.entries(n.props)
    .map(([k, v]) => formatProp(k, v))
    .join(" ");
  const open = props ? `${n.component} ${props}` : n.component;

  if (n.children.length === 0) return `${indent}<${open} />`;

  const children = n.children.map((c) => emitNode(c, indent + "  ")).join("\n");
  return `${indent}<${open}>\n${children}\n${indent}</${n.component}>`;
}

/** Collect the plot component names actually used, for a tidy import line. */
function usedComponents(
  root: RenderNode,
  seen = new Set<ComponentName>(),
): Set<ComponentName> {
  seen.add(root.component);
  for (const c of root.children) usedComponents(c, seen);
  return seen;
}

/** Emit a complete, self-contained UseGPU Live component module. */
export function emitSource(root: RenderNode, name = "GGChart"): string {
  const nonSerializable = (current: RenderNode): boolean =>
    current.props.nonSerializable === true ||
    current.children.some(nonSerializable);
  if (nonSerializable(root)) {
    throw new TypeError(
      "[gggplot] emitted source cannot serialize a custom 2D summary reducer; use a built-in reducer",
    );
  }
  const all = usedComponents(root);
  const used = PLOT_IMPORTS.filter((c) => all.has(c));
  const faceted = all.has("FacetGrid");
  const radial = all.has("RadialViewport");
  const panelViewport = faceted || all.has("PanelViewport");

  const liveImports = faceted || radial || panelViewport
    ? radial || panelViewport
      ? "createElement, Fragment, provide, useAwait, useContext, useMemo"
      : "createElement, Fragment, useAwait, useContext"
    : "createElement, Fragment, useAwait";
  const workbenchImports = [
    "FontLoader",
    ...(faceted || radial ? ["LayoutContext"] : []),
    ...(radial || panelViewport
      ? ["MatrixContext", "TransformContext", "useCombinedMatrixTransform"]
      : []),
  ];
  const workbenchImport = workbenchImports.length
    ? `\nimport { ${workbenchImports.join(", ")} } from "@use-gpu/workbench";`
    : "";
  const facetGridDef = faceted ? `\n${FACET_GRID_SOURCE}` : "";
  const radialViewportDef = radial ? `\n${RADIAL_VIEWPORT_SOURCE}` : "";
  const panelViewportDef = panelViewport ? `\n${PANEL_VIEWPORT_SOURCE}` : "";

  return `/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
import { ${liveImports} } from "@use-gpu/live";
import { ${used.join(", ")} } from "@use-gpu/plot";${workbenchImport}
${FONT_HOST_SOURCE}${facetGridDef}${radialViewportDef}${panelViewportDef}
// Generated by @gggplot/core. Do not edit by hand.
export const ${name} = ({ fontResources } = {}) => (
  <EmittedFontHost fontResources={fontResources}>
${emitNode(root, "    ")}
  </EmittedFontHost>
);
`;
}
