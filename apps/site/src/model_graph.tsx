/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// The model graph as a component tree (gggplot-vnh.18: no GGSpec). The
// builder is a plain function of the document, so the extension registry can
// resolve and run it headlessly.
import * as Jsx from "@gggplot/core/jsx";
import { GeomLine, ThemeMinimal } from "@gggplot/core";
import type { LiveElement } from "@use-gpu/live";
import { SitePlot } from "./site_plot.tsx";
import {
  buildGeometryProduct,
  type ModelDocument,
} from "@gggplot/model-inspect";

/**
 * Lower the current model document's graph summary into the existing gggplot
 * canvas. This is deliberately a view product: it consumes metadata and does
 * not imply that model tensors have been copied into a chart buffer.
 */
export function modelGraphChart(document: ModelDocument): LiveElement {
  const geometry = buildGeometryProduct(document);
  const rows = geometry.nodes.map((node) => ({ x: node.x, y: node.y }));
  const edgeRows = geometry.edges.flatMap((edge, index) =>
    edge.points.map((point) => ({ x: point.x, y: point.y, group: index }))
  );
  const markerRows = geometry.nodes.flatMap((node, index) => {
    const horizontalGroup = geometry.edges.length + index * 2;
    const verticalGroup = horizontalGroup + 1;
    return [
      { x: node.x - 0.08, y: node.y, group: horizontalGroup },
      { x: node.x + 0.08, y: node.y, group: horizontalGroup },
      { x: node.x, y: node.y - 0.08, group: verticalGroup },
      { x: node.x, y: node.y + 0.08, group: verticalGroup },
    ];
  });

  return (
    <SitePlot data={rows} mapping={{ x: "x", y: "y" }}>
      <ThemeMinimal />
      {edgeRows.length > 0
        ? (
          <GeomLine
            data={edgeRows}
            mapping={{ x: "x", y: "y", group: "group" }}
            inheritAes={false}
            color="#64748b"
            linewidth={1}
          />
        )
        : null}
      {markerRows.length > 0
        ? (
          <GeomLine
            data={markerRows}
            mapping={{ x: "x", y: "y", group: "group" }}
            inheritAes={false}
            color="#60a5fa"
            linewidth={3}
          />
        )
        : null}
    </SitePlot>
  );
}
