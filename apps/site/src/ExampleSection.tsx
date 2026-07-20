import React from "react";
import {
  columnValues,
  compile,
  emitSource,
  isTypedDataFrame,
} from "@gggplot/core";
import type { DataFrame } from "@gggplot/core";
import { ChartCanvas } from "./ChartCanvas.tsx";
import { staticDatasets } from "./docs/data/real.ts";
import type { DocExample } from "./docs/types.ts";
import { useResolvedExample } from "./hooks.ts";
import { styles } from "./styles.ts";

export function ExampleSection({
  index,
  example,
  compact,
  forceChartFailure,
}: {
  index: number;
  example: DocExample;
  compact: boolean;
  forceChartFailure: boolean;
}) {
  const resolved = useResolvedExample(example);
  const tree = resolved.spec ? compile(resolved.spec) : undefined;
  const emitted = tree ? emitSource(tree, example.id) : undefined;
  const nodeCount = tree ? countNodes(tree) : undefined;
  const dataset = example.dataSource
    ? staticDatasets[example.dataSource.id]
    : undefined;

  return (
    <section data-doc-example={example.id} style={styles.example}>
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
            ? (
              <ChartCanvas
                spec={resolved.spec}
                label={example.visualSummary ?? example.description}
                forceFailure={forceChartFailure}
              />
            )
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
