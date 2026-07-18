import * as Live from "@use-gpu/live";
import * as Plot from "@use-gpu/plot";
import { FontLoader } from "@use-gpu/workbench";
import type {
  ExtensionRegistry,
  LiveExtensionAdapter,
} from "@gggplot/core/plan";
import type { PointCloudRenderNode, PointCloudRenderProps } from "./types.ts";
import { registerPointCloud } from "./registry.ts";

/** Optional Live adapter: vec4 clip positions retain z for GPU depth testing. */
export const PointCloud = (props: PointCloudRenderProps) =>
  Live.createElement(
    FontLoader,
    {},
    Live.createElement(
      Plot.Embedded,
      { normalize: true },
      Live.createElement(Plot.Point, {
        positions: props.positions,
        ...(props.colors ? { colors: props.colors } : { color: props.color }),
        ...(props.sizes ? { sizes: props.sizes } : { size: props.size }),
        opacity: props.opacity,
        formats: props.formats,
        depthTest: props.depthTest,
        depthWrite: props.depthWrite,
      }),
    ),
  );

export const registerPointCloudLive = (registry?: ExtensionRegistry) =>
  registerPointCloud(PointCloud, registry);

export function renderPointCloud(
  node: PointCloudRenderNode,
  registry: ExtensionRegistry,
): unknown {
  const adapter = registry.resolveLive(node.component).adapters
    .live as LiveExtensionAdapter<typeof PointCloud>;
  return Live.createElement(adapter.value, node.props);
}
