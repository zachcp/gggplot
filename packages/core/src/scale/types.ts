import type { Scale } from "../ir/types.ts";

export interface TrainedScale extends Scale {
  domain: [number, number] | string[];
  /** Whether the visual range came from a declared scale rather than defaults. */
  rangeExplicit?: boolean;
}
