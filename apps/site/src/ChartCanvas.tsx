import React from "react";
import { LiveCanvas } from "@use-gpu/react";
import type { GGSpec } from "@gggplot/core";
import { Scene } from "./scene.tsx";

/** React host for the WebGPU Live plot scene. */
export function ChartCanvas(
  {
    spec,
    label,
    forceFailure = false,
  }: { spec: GGSpec; label: string; forceFailure?: boolean },
) {
  return (
    <ChartErrorBoundary>
      <div
        data-chart-surface="webgpu"
        role="img"
        aria-label={label}
        style={styles.frame}
      >
        {forceFailure ? <ForcedChartFailure /> : null}
        <LiveCanvas>
          {(canvas: HTMLCanvasElement) => <Scene canvas={canvas} spec={spec} />}
        </LiveCanvas>
      </div>
    </ChartErrorBoundary>
  );
}

interface BoundaryState {
  error?: Error;
}

/**
 * Live/WebGPU errors must be attributed to a single example rather than
 * leaving its panel indistinguishable from a successful dark plot surface.
 */
class ChartErrorBoundary extends React.Component<
  React.PropsWithChildren,
  BoundaryState
> {
  override state: BoundaryState = {};

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error("[gggplot chart failure]", error);
  }

  override render() {
    if (this.state.error) {
      return (
        <div data-chart-error="" role="alert" style={styles.failure}>
          <strong>Chart renderer failed</strong>
          <span>{this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

function ForcedChartFailure(): never {
  throw new Error("Forced chart failure (visual route-health probe)");
}

const styles: Record<string, React.CSSProperties> = {
  frame: {
    position: "relative",
    width: "100%",
    height: "clamp(240px, 48vw, 360px)",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #1e1e30",
    background: "#0a0a12",
  },
  failure: {
    minHeight: "clamp(240px, 48vw, 360px)",
    display: "grid",
    alignContent: "center",
    gap: 8,
    padding: 24,
    borderRadius: 8,
    border: "1px solid #f87171",
    background: "#2a1116",
    color: "#fecaca",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  },
};
