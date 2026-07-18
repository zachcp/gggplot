import {
  type ExtensionDefinition,
  ExtensionRegistry,
} from "@gggplot/core/plan";
import { POINT_CLOUD_EXTENSION_ID } from "./types.ts";

export const pointCloudDefinition: ExtensionDefinition = {
  id: POINT_CLOUD_EXTENSION_ID,
  kind: "geom",
  requiredAes: ["x", "y", "z"],
  optionalAes: ["color", "size"],
  parameters: {
    size: { type: "number", default: 6 },
    opacity: { type: "number", default: 1 },
    depthTest: { type: "boolean", default: true },
  },
  missingValues: "drop",
  scope: "panel",
  showLegend: "auto",
  capabilities: ["live", "emit"],
};

export function registerPointCloud(
  liveValue: unknown,
  registry = new ExtensionRegistry(),
): ExtensionRegistry {
  return registry.register(pointCloudDefinition, {
    live: { value: liveValue },
    emit: { importFrom: "@gggplot/3d", exportName: "PointCloud" },
  });
}
