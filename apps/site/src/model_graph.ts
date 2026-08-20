// Grammar only: a spec builder must not drag in the render layer, or it
// cannot be exercised headlessly through the extension registry.
import {
  aes,
  geomLine,
  type GGSpec,
  ggplot,
  themeMinimal,
} from "@gggplot/core/dsl";
import {
  buildGeometryProduct,
  type ModelDocument,
} from "@gggplot/model-inspect";

/**
 * Lower the current model document's graph summary into the existing gggplot
 * canvas. This is deliberately a view product: it consumes metadata and does
 * not imply that model tensors have been copied into a chart buffer.
 */
export function modelGraphSpec(document: ModelDocument): GGSpec {
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

  const spec = ggplot(rows, aes({ x: "x", y: "y" })).add(
    themeMinimal(),
  );

  if (edgeRows.length > 0) {
    spec.add(
      geomLine({
        data: edgeRows,
        mapping: aes({ x: "x", y: "y", group: "group" }),
        inheritAes: false,
        color: "#64748b",
        linewidth: 1,
      }),
    );
  }
  if (markerRows.length > 0) {
    spec.add(
      geomLine({
        data: markerRows,
        mapping: aes({ x: "x", y: "y", group: "group" }),
        inheritAes: false,
        color: "#60a5fa",
        linewidth: 3,
      }),
    );
  }
  return spec.build();
}
