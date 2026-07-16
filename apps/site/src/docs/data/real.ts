import type { TypedDataFrame } from "../../../../../packages/core/src/data/mod.ts";
import { typedCsv } from "./csv.ts";

export interface StaticDataset {
  readonly id: "mpg" | "mtcars" | "iris";
  readonly title: string;
  readonly rows: number;
  readonly columns: number;
  readonly url: string;
  readonly provenance: string;
}

/** Static assets are fetched once, then lowered straight into typed columns. */
export const staticDatasets: Record<StaticDataset["id"], StaticDataset> = {
  mpg: {
    id: "mpg",
    title: "Fuel economy",
    rows: 234,
    columns: 11,
    url: "/data/mpg.csv",
    provenance: "ggplot2 mpg, mirrored as CSV by Rdatasets",
  },
  mtcars: {
    id: "mtcars",
    title: "Motor Trend car road tests",
    rows: 32,
    columns: 11,
    url: "/data/mtcars.csv",
    provenance: "R datasets mtcars, mirrored as CSV by Rdatasets",
  },
  iris: {
    id: "iris",
    title: "Fisher iris measurements",
    rows: 150,
    columns: 5,
    url: "/data/iris.csv",
    provenance: "R datasets iris, mirrored as CSV by Rdatasets",
  },
};

const cache = new Map<StaticDataset["id"], Promise<TypedDataFrame>>();

export async function loadStaticDataset(
  id: StaticDataset["id"],
  request: typeof fetch = fetch,
): Promise<TypedDataFrame> {
  const cached = cache.get(id);
  if (cached) return cached;
  const dataset = staticDatasets[id];
  const pending = request(dataset.url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Unable to load ${id}: ${response.status}`);
    }
    return typedCsv(await response.text());
  });
  cache.set(id, pending);
  try {
    return await pending;
  } catch (error) {
    cache.delete(id);
    throw error;
  }
}
