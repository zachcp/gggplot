import React from "react";
import { compile, emitSource } from "@gggplot/core";
import { ChartCanvas } from "./ChartCanvas.tsx";
import { examples } from "./examples.tsx";

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

      {examples.map((example, i) => (
        <ExampleSection key={example.id} index={i + 1} example={example} />
      ))}
    </div>
  );
}

function ExampleSection({
  index,
  example,
}: {
  index: number;
  example: (typeof examples)[number];
}) {
  const emitted = emitSource(compile(example.spec), example.id);

  return (
    <section style={styles.example}>
      <div style={styles.exampleHeader}>
        <h2 style={styles.exampleTitle}>
          {index} · {example.title}
        </h2>
        <p style={styles.exampleDescription}>{example.description}</p>
      </div>

      <section style={styles.grid}>
        <Panel title="ggplot DSL">
          <pre style={styles.pre}>{example.dslSource}</pre>
        </Panel>
        <Panel title="emitted UseGPU Live source">
          <pre style={styles.pre}>{emitted}</pre>
        </Panel>
      </section>

      <section style={styles.canvasSection}>
        <Panel title="live WebGPU render">
          <ChartCanvas spec={example.spec} />
          <p style={styles.note}>
            Requires a WebGPU browser (Chrome/Edge 113+, Safari 18+). Font/glyph
            WASM loading under Vite's Rolldown bundler is still being fixed — see
            the project's beads issues — so this may render blank for now.
          </p>
        </Panel>
      </section>
    </section>
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
  example: { marginBottom: 40 },
  exampleHeader: { marginBottom: 12 },
  exampleTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: "#e8e8f0",
    marginBottom: 4,
  },
  exampleDescription: { fontSize: 13, color: "#9090b0", lineHeight: 1.5 },
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
