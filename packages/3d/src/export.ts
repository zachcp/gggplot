import * as Live from "@use-gpu/live";
import { type GgSaveOptions, saveLivePng } from "@gggplot/core/export";
import type { ExtensionRegistry } from "@gggplot/core/plan";
import { compilePointCloud } from "./compile.ts";
import { registerPointCloudLive, renderPointCloud } from "./live.ts";
import type { PointCloudSpec } from "./types.ts";

/** Render a serializable point-cloud spec to an exact-size PNG. */
export function ggsavePointCloud(
  spec: PointCloudSpec,
  options: GgSaveOptions,
  registry?: ExtensionRegistry,
): Promise<Blob> {
  const activeRegistry = registry ?? registerPointCloudLive();
  const node = compilePointCloud(spec, activeRegistry);
  return saveLivePng(
    () => renderPointCloud(node, activeRegistry) as Live.LiveElement,
    options,
  );
}
