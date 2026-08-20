import React from "react";
import { LiveCanvas } from "@use-gpu/react";
import type { GGSpec, PrismInstance3D } from "@gggplot/core";
import { Scene3D } from "./scene3d.tsx";

/** WebGPU host for an ordinary GGSpec whose mapped positions include z. */
export function ChartCanvas3D(
  {
    spec,
    label,
    prismInstances,
  }: {
    spec: GGSpec;
    label: string;
    prismInstances?: readonly PrismInstance3D[];
  },
) {
  // Remounting restores OrbitControls' initial serialized camera while leaving
  // the spec and renderer-owned scene data untouched.
  const [cameraEpoch, setCameraEpoch] = React.useState(0);
  return (
    <ChartErrorBoundary>
      <div
        data-chart-surface="webgpu-3d"
        role="group"
        aria-label={label}
        style={styles.frame}
      >
        <LiveCanvas key={cameraEpoch}>
          {(canvas: HTMLCanvasElement) => (
            <Scene3D
              canvas={canvas}
              spec={spec}
              prismInstances={prismInstances}
            />
          )}
        </LiveCanvas>
        <div style={styles.navigation} aria-label="3D camera controls">
          <span>Drag orbit · Shift-drag / right-drag pan · scroll zoom</span>
          <button
            type="button"
            onClick={() => setCameraEpoch((epoch) => epoch + 1)}
            style={styles.resetButton}
          >
            Reset camera
          </button>
        </div>
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
    // A block canvas needs an explicit height. Framing itself is now resolution-
    // independent (gggplot-4q2.8.3: pixel-constant sizing, no OrbitCamera.scale),
    // so this is a plain layout choice, not a framing workaround.
    height: 300,
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #1e1e30",
    background: "#0a0a12",
  },
  navigation: {
    position: "absolute",
    right: 8,
    bottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 8,
    maxWidth: "calc(100% - 16px)",
    padding: "5px 7px",
    borderRadius: 5,
    color: "#cbd5e1",
    background: "rgb(10 10 18 / 88%)",
    border: "1px solid rgb(148 163 184 / 30%)",
    fontSize: 11,
    lineHeight: 1.2,
    pointerEvents: "none",
  },
  resetButton: {
    flex: "0 0 auto",
    padding: "3px 6px",
    border: "1px solid #64748b",
    borderRadius: 4,
    color: "#e2e8f0",
    background: "#1e293b",
    font: "inherit",
    cursor: "pointer",
    pointerEvents: "auto",
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
