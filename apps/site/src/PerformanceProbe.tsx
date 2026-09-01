import React, { useState } from "react";
import { geomHistogram, ggplot, ingest } from "@gggplot/core";
import type { GGSpec } from "@gggplot/core";
import { ChartCanvas } from "./ChartCanvas.tsx";

const ROW_OPTIONS = [100_000, 1_000_000] as const;

/** Lazy, explicit generated-data route; no rows exist until the button is used. */
export function PerformanceProbe(): React.ReactElement {
  const [rows, setRows] = useState<number>(ROW_OPTIONS[0]);
  const [spec, setSpec] = useState<GGSpec>();
  const [generated, setGenerated] = useState<{ rows: number; ms: number }>();
  const [running, setRunning] = useState(false);

  const generate = () => {
    setRunning(true);
    // Let React paint the busy state before the deliberately synchronous build.
    requestAnimationFrame(() => {
      const started = performance.now();
      const x = new Array<number>(rows);
      for (let i = 0; i < rows; i++) {
        // Deterministic mixture with a non-trivial histogram shape.
        x[i] = Math.sin(i * 0.017) * 1.8 + Math.sin(i * 0.003) * 0.7;
      }
      const data = ingest({ x });
      setSpec(
        ggplot(data, { x: "x" })
          .add(geomHistogram({ bins: 64, fill: "#2563eb" }))
          .build(),
      );
      setGenerated({ rows, ms: performance.now() - started });
      setRunning(false);
    });
  };

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Opt-in resident histogram</h1>
      <p style={styles.copy}>
        This route generates no data on normal docs load. After you opt in, the
        live compiler selects the GPU-resident histogram product; generated rows
        are neither previewed nor emitted as source.
      </p>
      <p style={styles.warning}>
        The roughly five-second number in PERF_BASELINE is not this operation.
        It measures CPU packing of one million input{" "}
        <em>bars</em>; this route demonstrates a resident histogram over
        generated observations.
      </p>
      <label style={styles.control}>
        Generated observations
        <select
          value={rows}
          onChange={(event) => setRows(Number(event.currentTarget.value))}
          disabled={running}
          style={styles.select}
        >
          {ROW_OPTIONS.map((count) => (
            <option key={count} value={count}>{count.toLocaleString()}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={generate}
        disabled={running}
        style={styles.button}
      >
        {running ? "Generating…" : "Generate and render"}
      </button>
      {generated
        ? (
          <p data-performance-result style={styles.result}>
            Generated and built {generated.rows.toLocaleString()}{" "}
            observations in {generated.ms.toFixed(1)}{" "}
            ms. Live flow: GPU-resident histogram.
          </p>
        )
        : (
          <p data-performance-idle style={styles.idle}>
            Idle: zero generated rows.
          </p>
        )}
      {spec
        ? (
          <ChartCanvas
            spec={spec}
            label={`Resident histogram over ${generated?.rows.toLocaleString()} generated observations`}
          />
        )
        : null}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 820,
    margin: "0 auto",
    padding: 28,
    color: "#dbeafe",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  },
  heading: { fontSize: 28, color: "#f8fafc" },
  copy: { lineHeight: 1.6, color: "#b6c2d9" },
  warning: {
    padding: 12,
    border: "1px solid #854d0e",
    borderRadius: 7,
    background: "#2b1d0b",
    color: "#fde68a",
    lineHeight: 1.5,
  },
  control: { display: "grid", gap: 6, margin: "16px 0", maxWidth: 280 },
  select: {
    padding: 8,
    border: "1px solid #3a465f",
    borderRadius: 6,
    background: "#0f1725",
    color: "#e2e8f0",
  },
  button: {
    padding: "9px 13px",
    border: "1px solid #3b82f6",
    borderRadius: 7,
    background: "#172554",
    color: "#dbeafe",
    cursor: "pointer",
    fontWeight: 700,
  },
  result: { color: "#a7f3d0", lineHeight: 1.5 },
  idle: { color: "#94a3b8" },
};
