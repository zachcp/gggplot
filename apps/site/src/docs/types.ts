import type { DataFrame } from "@gggplot/core";
import type { LiveElement } from "@use-gpu/live";
import type { ModelDocument } from "@gggplot/model-inspect";

/** A 3D showcase on a docs page: a component-form plot that maps z. */
export interface ThreeDShowcase {
  id: string;
  title: string;
  description: string;
  /** The showcase as a component-form <GGPlot> tree (gggplot-vnh.10.1). */
  chart: () => LiveElement;
  /** The same code as the reader sees it. */
  jsxSource: string;
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
  | "model-inspection"
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
  /**
   * The example: a Live component rendering a <GGPlot> tree (SitePlot), with
   * its JSX shown to the reader in `jsxSource` (jsx_source_test.ts keeps the
   * two in step).
   */
  chart: () => LiveElement;
  jsxSource: string;
  /** Explanation shown beside the execution flow detected from the live tree. */
  executionDetail?: string;
  /** Optional route for an interactive or instrumented companion demonstration. */
  action?: { href: string; label: string };
  /**
   * A static dataset the chart loads through <GGData load> when mounted; the
   * preview panel loads it the same way.
   */
  dataSource?: { id: "mpg" | "mtcars" | "iris" };
}

export interface DocNarrative {
  heading: string;
  body: string;
  action?: { href: string; label: string };
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
  /** Optional model-inspection previews, which are not ordinary chart examples. */
  modelExamples?: ModelInspectionExample[];
}

export interface ModelInspectionExample {
  id: string;
  title: string;
  description: string;
  document: ModelDocument;
  ownership: "visualizer-owned" | "runtime-shared" | "runtime-copy-on-demand";
  ownershipReason: string;
}
