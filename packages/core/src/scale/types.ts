import type { Scale } from "../ir/types.ts";

export interface TrainedScale extends Scale {
  domain: [number, number] | string[];
}
