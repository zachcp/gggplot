import React from "react";
import { LiveCanvas } from "@use-gpu/react";
import type { Point3DSpec } from "@gggplot/core/geom_3d";
import { Scene3D } from "./scene3d.tsx";

/** WebGPU host for a 3D geom_3d scene (mirrors the 2D ChartCanvas). */
export function ChartCanvas3D(
  { spec, label }: { spec: Point3DSpec; label: string },
) {
  return (
    <ChartErrorBoundary>
      <div
        data-chart-surface="webgpu-3d"
        role="img"
        aria-label={label}
        style={styles.frame}
      >
        <LiveCanvas>
          {(canvas: HTMLCanvasElement) => (
            <Scene3D canvas={canvas} spec={spec} />
          )}
        </LiveCanvas>
      </div>
    </ChartErrorBoundary>
  );
}

class ChartErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error?: Error }
> {
  override state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error) {
    console.error("[gggplot 3d chart failure]", error);
  }
  override render() {
    if (this.state.error) {
      return (
        <div data-chart-error="" role="alert" style={styles.failure}>
          <strong>3D chart renderer failed</strong>
          <span>{this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  frame: {
    position: "relative",
    width: "100%",
    height: "clamp(320px, 40vw, 460px)",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #1e1e30",
    background: "#0a0a12",
  },
  failure: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    gap: 6,
    color: "#fca5a5",
    background: "#1a0e12",
    padding: 16,
    textAlign: "center",
  },
};
