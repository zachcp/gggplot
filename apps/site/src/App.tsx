import React from "react";
import {
  compile,
  emitSource,
  geomLine,
  geomPoint,
  ggplot,
} from "@gggplot/core";
import { ChartCanvas } from "./ChartCanvas.tsx";

// The DSL source shown to the reader — kept in sync with `spec` below by hand.
const DSL_SOURCE = `ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 6, color: "#3b82f6" }))
  .add(geomLine({ color: "#ef4444" }))
  .build();`;

const data = {
  wt: [2.6, 3.2, 3.4, 1.9, 4.1, 2.2, 3.8, 2.9],
  mpg: [21, 19, 18, 27, 15, 24, 16, 22],
};

const spec = ggplot(data, { x: "wt", y: "mpg" })
  .add(geomPoint({ size: 6, color: "#3b82f6" }))
  .add(geomLine({ color: "#ef4444" }))
  .build();

const emitted = emitSource(compile(spec), "ScatterChart");

export function App() {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>gggplot</h1>
        <p style={styles.lead}>
          A <strong>ggplot → UseGPU Live</strong> transpiler. A grammar-of-graphics
          spec is compiled to a render tree, then either rendered live on WebGPU
          or emitted as standalone{" "}
          <code style={styles.code}>@use-gpu/plot</code> source.
        </p>
      </header>

      <section style={styles.grid}>
        <Panel title="1 · ggplot DSL">
          <pre style={styles.pre}>{DSL_SOURCE}</pre>
        </Panel>
        <Panel title="2 · emitted UseGPU Live source">
          <pre style={styles.pre}>{emitted}</pre>
        </Panel>
      </section>

      <section style={styles.canvasSection}>
        <Panel title="3 · live WebGPU render">
          <ChartCanvas spec={spec} />
          <p style={styles.note}>
            Requires a WebGPU browser (Chrome/Edge 113+, Safari 18+). 2D camera
            wiring is still being tuned — see the project's beads issues.
          </p>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelTitle}>{title}</div>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1100, margin: "0 auto", padding: 32 },
  header: { marginBottom: 24 },
  title: { fontSize: 30, fontWeight: 700, color: "#e8e8f0", marginBottom: 8 },
  lead: { fontSize: 15, color: "#9090b0", lineHeight: 1.6, maxWidth: 760 },
  code: {
    fontFamily: "monospace",
    background: "#1e1e2e",
    padding: "1px 5px",
    borderRadius: 3,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
    gap: 16,
    marginBottom: 16,
  },
  canvasSection: {},
  panel: {
    background: "#12121e",
    border: "1px solid #1e1e30",
    borderRadius: 8,
    padding: 16,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#a0b8ff",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pre: {
    fontFamily: "monospace",
    fontSize: 12.5,
    color: "#c8d0e8",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    overflowX: "auto",
  },
  note: { fontSize: 12, color: "#6a6a90", marginTop: 10, lineHeight: 1.5 },
};
