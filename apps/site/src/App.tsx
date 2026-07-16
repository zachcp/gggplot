import React from "react";
import {
  columnValues,
  compile,
  emitSource,
  isTypedDataFrame,
} from "@gggplot/core";
import type { DataFrame } from "@gggplot/core";
import { ChartCanvas } from "./ChartCanvas.tsx";
import { loadStaticDataset, staticDatasets } from "./docs/data/real.ts";
import { docPages } from "./docs/pages.ts";
import type { DocExample, DocPage } from "./docs/types.ts";

// Vite publishes the repository's normative architecture document as an asset,
// so the contributor reference remains reachable from the docs-site nav.
const architectureReference = new URL(
  "../../../docs/ARCHITECTURE.md",
  import.meta.url,
).href;

export function App() {
  const viewportWidth = useViewportWidth();
  const compact = viewportWidth < 820;
  const [activeSlug, setActiveSlug] = React.useState(() =>
    docPages.some((page) => page.slug === location.hash.slice(1))
      ? location.hash.slice(1)
      : docPages[0].slug
  );
  const activePage = docPages.find((page) => page.slug === activeSlug) ??
    docPages[0];

  React.useEffect(() => {
    const onHashChange = () => {
      const slug = location.hash.slice(1);
      if (docPages.some((page) => page.slug === slug)) setActiveSlug(slug);
    };
    addEventListener("hashchange", onHashChange);
    return () => removeEventListener("hashchange", onHashChange);
  }, []);

  const openPage = (page: DocPage) => {
    setActiveSlug(page.slug);
    history.replaceState(null, "", `#${page.slug}`);
  };

  return (
    <div style={{ ...styles.page, ...(compact ? styles.pageCompact : {}) }}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>gggplot</h1>
          <p style={styles.lead}>
            A modular feature tour for the{" "}
            <strong>{"ggplot -> UseGPU Live"}</strong>{" "}
            pipeline: data, stats, aesthetics, RenderTree output, and live
            WebGPU rendering.
          </p>
        </div>
      </header>

      <div style={{ ...styles.shell, ...(compact ? styles.shellCompact : {}) }}>
        <nav
          style={{ ...styles.nav, ...(compact ? styles.navCompact : {}) }}
          aria-label="Feature modules"
          data-scroll-nav={compact ? "" : undefined}
        >
          <div
            style={{
              ...styles.navTitle,
              ...(compact ? styles.navTitleCompact : {}),
            }}
          >
            Feature tour
          </div>
          {docPages.map((page) => (
            <button
              key={page.slug}
              type="button"
              style={{
                ...styles.navButton,
                ...(compact ? styles.navButtonCompact : {}),
                ...(activePage.slug === page.slug
                  ? styles.navButtonActive
                  : {}),
              }}
              onClick={() => openPage(page)}
            >
              <span style={styles.navButtonTitle}>{page.title}</span>
              <span style={styles.navButtonMeta}>
                {page.examples.length}{" "}
                example{page.examples.length === 1 ? "" : "s"}
              </span>
            </button>
          ))}
          <a
            href={architectureReference}
            style={{ ...styles.navButton, ...styles.architectureLink }}
          >
            <span style={styles.navButtonTitle}>Architecture reference</span>
            <span style={styles.navButtonMeta}>contributor doc</span>
          </a>
        </nav>

        <main style={styles.content}>
          <section style={styles.pageIntro}>
            <div style={styles.kicker}>{activePage.section}</div>
            <h2 style={styles.pageTitle}>{activePage.title}</h2>
            <p style={styles.pageSummary}>{activePage.summary}</p>
          </section>

          {activePage.narrative?.map((section) => (
            <section key={section.heading} style={styles.narrative}>
              <h3 style={styles.narrativeTitle}>{section.heading}</h3>
              <p style={styles.bodyCopy}>{section.body}</p>
            </section>
          ))}

          {activePage.examples.map((example, i) => (
            <ExampleSection
              key={example.id}
              index={i + 1}
              example={example}
              compact={compact}
            />
          ))}
        </main>
      </div>
    </div>
  );
}

function ExampleSection({
  index,
  example,
  compact,
}: {
  index: number;
  example: DocExample;
  compact: boolean;
}) {
  const resolved = useResolvedExample(example);
  const tree = resolved.spec ? compile(resolved.spec) : undefined;
  const emitted = tree ? emitSource(tree, example.id) : undefined;
  const nodeCount = tree ? countNodes(tree) : undefined;
  const dataset = example.dataSource
    ? staticDatasets[example.dataSource.id]
    : undefined;

  return (
    <section style={styles.example}>
      <div style={styles.exampleHeader}>
        <div style={styles.exampleIndex}>{String(index).padStart(2, "0")}</div>
        <div>
          <h3 style={styles.exampleTitle}>{example.title}</h3>
          <p style={styles.exampleDescription}>{example.description}</p>
          {dataset
            ? (
              <p style={styles.datasetNote}>
                Dataset: {dataset.title} ({dataset.rows} rows, {dataset.columns}
                {" "}
                columns) — {dataset.provenance}.
              </p>
            )
            : null}
        </div>
      </div>

      <div style={styles.detailGrid}>
        <Panel title="Data preview">
          <DataPreview data={resolved.data ?? example.dataPreview} />
        </Panel>
        {example.computedDataPreview
          ? (
            <Panel title="Computed stat rows">
              <DataPreview data={example.computedDataPreview} />
            </Panel>
          )
          : null}
        <Panel title="What changed">
          <p style={styles.bodyCopy}>{example.whatChanged}</p>
          <p style={styles.metaCopy}>
            {nodeCount === undefined
              ? resolved.error
                ? `Dataset load failed: ${resolved.error}`
                : "Loading typed dataset lazily…"
              : `RenderTree: ${nodeCount} nodes after stats, scales, coords, guides, and theme.`}
          </p>
        </Panel>
      </div>

      <section
        style={{ ...styles.grid, ...(compact ? styles.gridCompact : {}) }}
      >
        <Panel title="ggplot DSL">
          <pre style={styles.pre}>{example.dslSource}</pre>
        </Panel>
        <Panel title="live WebGPU render">
          {resolved.spec
            ? <ChartCanvas spec={resolved.spec} />
            : (
              <p style={styles.metaCopy}>
                {resolved.error ?? "Loading chart data…"}
              </p>
            )}
          <p style={styles.note}>
            Requires a WebGPU browser. If the canvas is blank, the DSL and
            emitted source still show the compiler output for this feature.
          </p>
        </Panel>
      </section>

      <details style={styles.details}>
        <summary style={styles.summary}>Emitted UseGPU Live source</summary>
        <pre style={styles.pre}>{emitted ?? "Loading typed dataset…"}</pre>
      </details>
    </section>
  );
}

interface ResolvedExample {
  spec?: import("@gggplot/core").GGSpec;
  data?: DataFrame;
  error?: string;
}

/** Resolve real datasets only for mounted examples; static specs stay immediate. */
function useResolvedExample(example: DocExample): ResolvedExample {
  const [resolved, setResolved] = React.useState<ResolvedExample>(() => ({
    spec: example.spec,
  }));

  React.useEffect(() => {
    if (!example.dataSource) {
      setResolved({ spec: example.spec });
      return;
    }
    let cancelled = false;
    setResolved({});
    loadStaticDataset(example.dataSource.id)
      .then((data) => {
        if (!cancelled) setResolved({ data, spec: example.buildSpec?.(data) });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResolved({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [example]);

  return resolved;
}

function useViewportWidth(): number {
  const [width, setWidth] = React.useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth
  );

  React.useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);

  return width;
}

function Panel(
  { title, children }: { title: string; children: React.ReactNode },
) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>{title}</div>
      {children}
    </div>
  );
}

function DataPreview(
  { data }: { data?: Record<string, unknown[]> | DataFrame },
) {
  if (!data) return <p style={styles.metaCopy}>No preview data provided.</p>;
  const columns = Object.keys(data);
  const valuesFor = (column: string) =>
    isTypedDataFrame(data) ? columnValues(data, column) : data[column] ?? [];
  const totalRows = Math.max(
    0,
    ...columns.map((col) => valuesFor(col).length),
  );
  const rowCount = Math.min(5, totalRows);
  if (columns.length === 0 || totalRows === 0) {
    return <p style={styles.metaCopy}>No rows to preview.</p>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => <th key={col} style={styles.th}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, row) => (
            <tr key={row}>
              {columns.map((col) => (
                <td key={col} style={styles.td}>
                  {String(valuesFor(col)[row] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totalRows > rowCount
        ? (
          <p style={styles.tableNote}>
            Showing {rowCount} of {totalRows} rows.
          </p>
        )
        : null}
    </div>
  );
}

function countNodes(node: { children?: unknown[] }): number {
  const children = (node.children ?? []) as Array<{ children?: unknown[] }>;
  return 1 + children.reduce((total, child) => total + countNodes(child), 0);
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "28px 28px 48px",
  },
  pageCompact: {
    padding: "18px 14px 36px",
    overflowX: "hidden",
  },
  header: {
    marginBottom: 22,
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
  },
  title: { fontSize: 30, fontWeight: 700, color: "#f5f7fb", marginBottom: 8 },
  lead: { fontSize: 15, color: "#a8adbd", lineHeight: 1.6, maxWidth: 820 },
  shell: {
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr)",
    gap: 22,
    alignItems: "start",
  },
  shellCompact: {
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 16,
  },
  nav: {
    position: "sticky",
    top: 18,
    display: "grid",
    gap: 6,
    borderRight: "1px solid #242938",
    paddingRight: 14,
  },
  navCompact: {
    position: "static",
    display: "flex",
    overflowX: "auto",
    borderRight: "none",
    borderBottom: "1px solid #242938",
    paddingRight: 0,
    paddingBottom: 10,
    gap: 8,
  },
  navTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#7dd3fc",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  navTitleCompact: { display: "none" },
  navButton: {
    border: "1px solid transparent",
    background: "transparent",
    color: "#c8d0e8",
    textAlign: "left",
    padding: "9px 10px",
    borderRadius: 8,
    cursor: "pointer",
    display: "grid",
    gap: 2,
  },
  navButtonCompact: {
    flex: "0 0 148px",
    padding: "8px 10px",
  },
  navButtonActive: {
    background: "#151a26",
    borderColor: "#2d3850",
    color: "#ffffff",
  },
  navButtonTitle: { fontSize: 13.5, fontWeight: 650 },
  navButtonMeta: { fontSize: 11.5, color: "#858da1" },
  architectureLink: {
    textDecoration: "none",
    marginTop: 8,
    borderTop: "1px solid #2d3850",
    borderRadius: 0,
    paddingTop: 12,
  },
  content: { minWidth: 0 },
  pageIntro: {
    paddingBottom: 18,
    marginBottom: 22,
    borderBottom: "1px solid #242938",
  },
  kicker: {
    fontSize: 12,
    color: "#7dd3fc",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  pageTitle: {
    fontSize: 24,
    color: "#f5f7fb",
    marginBottom: 6,
  },
  pageSummary: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "#a8adbd",
    maxWidth: 780,
  },
  narrative: {
    background: "#10141e",
    border: "1px solid #242938",
    borderRadius: 8,
    padding: "14px 16px",
    marginBottom: 18,
  },
  narrativeTitle: {
    color: "#dbeafe",
    fontSize: 15,
    marginBottom: 7,
  },
  example: {
    paddingBottom: 34,
    marginBottom: 36,
    borderBottom: "1px solid #202433",
  },
  exampleHeader: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr)",
    gap: 12,
    alignItems: "start",
    marginBottom: 14,
  },
  exampleIndex: {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    border: "1px solid #2d3850",
    borderRadius: 8,
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: 700,
  },
  exampleTitle: {
    fontSize: 18,
    fontWeight: 650,
    color: "#f5f7fb",
    marginBottom: 4,
  },
  exampleDescription: { fontSize: 13.5, color: "#a8adbd", lineHeight: 1.5 },
  datasetNote: {
    margin: "7px 0 0",
    color: "#8aa3c7",
    fontSize: 12,
    lineHeight: 1.45,
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
    marginBottom: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 0.92fr) minmax(360px, 1.08fr)",
    gap: 14,
    marginBottom: 14,
  },
  gridCompact: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  panel: {
    background: "#121722",
    border: "1px solid #242938",
    borderRadius: 8,
    padding: 14,
    minWidth: 0,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#93c5fd",
    marginBottom: 9,
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },
  bodyCopy: {
    fontSize: 13,
    color: "#d3d8e6",
    lineHeight: 1.55,
    marginBottom: 10,
  },
  metaCopy: { fontSize: 12.5, color: "#858da1", lineHeight: 1.5 },
  pre: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: 12.5,
    color: "#d7def1",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    overflowX: "auto",
  },
  note: { fontSize: 12, color: "#858da1", marginTop: 10, lineHeight: 1.5 },
  details: {
    background: "#10141e",
    border: "1px solid #242938",
    borderRadius: 8,
    padding: "12px 14px",
  },
  summary: {
    color: "#93c5fd",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 650,
    marginBottom: 10,
  },
  tableWrap: { overflowX: "auto" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12.5,
  },
  th: {
    color: "#93c5fd",
    textAlign: "left",
    padding: "0 10px 7px 0",
    borderBottom: "1px solid #2d3850",
    fontWeight: 700,
  },
  td: {
    color: "#d3d8e6",
    padding: "7px 10px 0 0",
    whiteSpace: "nowrap",
  },
  tableNote: {
    fontSize: 11.5,
    color: "#858da1",
    marginTop: 8,
  },
};
