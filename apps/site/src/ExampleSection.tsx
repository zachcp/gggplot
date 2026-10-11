import React from "react";
import { columnValues, isTypedDataFrame } from "@gggplot/core";
import type { DataFrame } from "@gggplot/core";
import { ChartCanvas } from "./ChartCanvas.tsx";
import { loadStaticDataset, staticDatasets } from "./docs/data/real.ts";
import type { DocExample } from "./docs/types.ts";
import { styles } from "./styles.ts";

/** A static dataset for the preview panel, loaded only when shown. */
function useDatasetPreview(
  id: "mpg" | "mtcars" | "iris" | undefined,
): { data?: DataFrame; error?: string } {
  const [state, setState] = React.useState<
    { data?: DataFrame; error?: string }
  >(
    {},
  );
  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadStaticDataset(id).then(
      (data) => !cancelled && setState({ data }),
      (error: unknown) =>
        !cancelled &&
        setState({
          error: error instanceof Error ? error.message : String(error),
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);
  return state;
}

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
  const dataset = example.dataSource
    ? staticDatasets[example.dataSource.id]
    : undefined;
  const preview = useDatasetPreview(example.dataSource?.id);

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
          {preview.error
            ? (
              <p style={styles.metaCopy}>
                Dataset load failed: {preview.error}
              </p>
            )
            : <DataPreview data={preview.data ?? example.dataPreview} />}
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
          {example.executionDetail
            ? <p style={styles.metaCopy}>{example.executionDetail}</p>
            : null}
          {example.action
            ? (
              <a href={example.action.href} style={styles.actionLink}>
                {example.action.label}
              </a>
            )
            : null}
        </Panel>
      </div>

      <section
        style={{ ...styles.grid, ...(compact ? styles.gridCompact : {}) }}
      >
        <Panel title="Component JSX">
          <pre style={styles.pre}>{example.jsxSource}</pre>
        </Panel>
        <Panel title="live WebGPU render">
          <ChartCanvas
            chart={example.chart}
            label={example.visualSummary ?? example.description}
            forceFailure={forceChartFailure}
          />
          <p style={styles.note}>
            Requires a WebGPU browser. If the canvas is blank, the component JSX
            still shows the plot this example builds.
          </p>
        </Panel>
      </section>
    </section>
  );
}

export function Panel(
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
