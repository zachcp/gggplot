import type { DataFrame, GGSpec } from "@gggplot/core";

/** A 3D GGSpec preview on a docs page. */
export interface ThreeDShowcase {
  id: string;
  title: string;
  description: string;
  /**
   * The real shared builder expression that produced this showcase.
   */
  dslSource: string;
  spec: GGSpec;
  /** Real emitted use.gpu source for the lowered node. */
  emitted: string;
  /** One-line summary of the lowered node (point count, ranges, camera). */
  summary: string;
}

export type DocSection =
  | "start"
  | "representations"
  | "stats"
  | "aesthetics"
  | "data"
  | "scales"
  | "positions"
  | "facets"
  | "coords"
  | "annotations"
  | "themes"
  | "internals"
  | "guides"
  | "faq"
  | "reference";

export interface DocExample {
  id: string;
  title: string;
  description: string;
  /** Accessible summary of the intended visual result; falls back to description. */
  visualSummary?: string;
  whatChanged: string;
  dataPreview?: Record<string, unknown[]>;
  computedDataPreview?: DataFrame;
  /** DSL source shown to the reader - kept in sync with `spec` by hand. */
  dslSource: string;
  /** Inline examples are immediately compilable. */
  spec?: GGSpec;
  /**
   * Real data is loaded only when its example is mounted. The builder receives
   * the typed, column-oriented frame rather than row objects.
   */
  dataSource?: { id: "mpg" | "mtcars" | "iris" };
  buildSpec?: (data: DataFrame) => GGSpec;
}

export interface DocNarrative {
  heading: string;
  body: string;
}

export interface GeomReferenceEntry {
  constructor: string;
  geom: string;
  summary: string;
  defaultStat: string;
  defaultPosition: string;
  requiredAesthetics: readonly string[];
  optionalAesthetics: readonly string[];
  params: Readonly<Record<string, string>>;
  residency: string;
  exampleIds: readonly string[];
}

export interface DocPage {
  slug: string;
  section: DocSection;
  title: string;
  summary: string;
  narrative?: DocNarrative[];
  geomReferences?: GeomReferenceEntry[];
  examples: DocExample[];
  /** Optional 3D previews shown below the 2D examples. */
  threeD?: ThreeDShowcase[];
}
