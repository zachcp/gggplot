import type { DataFrame, GGSpec } from "@gggplot/core";

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
  | "faq";

export interface DocExample {
  id: string;
  title: string;
  description: string;
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

export interface DocPage {
  slug: string;
  section: DocSection;
  title: string;
  summary: string;
  narrative?: DocNarrative[];
  examples: DocExample[];
}
