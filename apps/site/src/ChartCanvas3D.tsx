import React from "react";
import { LiveCanvas } from "@use-gpu/react";
import type {
  GGSpec,
  PrismInstance3D,
  ScenePickFn,
  SceneRay,
} from "@gggplot/core";
import { pointerToUV } from "@gggplot/core";
import { Scene3D } from "./scene3d.tsx";

/** How far the pointer may travel between down and up and still count as a click. */
const CLICK_SLOP_PX = 4;

export type ScenePickPhase = "hover" | "select";

/** WebGPU host for an ordinary GGSpec whose mapped positions include z. */
export function ChartCanvas3D(
  {
    spec,
    label,
    prismInstances,
    onPick,
  }: {
    spec: GGSpec;
    label: string;
    prismInstances?: readonly PrismInstance3D[];
    /**
     * Receives a world-space ray for pointer moves and clicks over the canvas.
     * The caller decides what the ray hits — this component knows about
     * pointers and cameras, not about what is in the scene.
     */
    onPick?: (ray: SceneRay | null, phase: ScenePickPhase) => void;
  },
) {
  // Remounting restores OrbitControls' initial serialized camera while leaving
  // the spec and renderer-owned scene data untouched.
  const [cameraEpoch, setCameraEpoch] = React.useState(0);
  // Installed by <ScenePicker> from inside the live tree; null until the scene
  // mounts, and replaced whenever a camera remount swaps the view context.
  const pick = React.useRef<ScenePickFn | null>(null);
  // Stable identity: live compares component props, and a changing callback
  // would remount the picker on every host render.
  const publishPick = React.useCallback((fn: ScenePickFn | null) => {
    pick.current = fn;
  }, []);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const pressAt = React.useRef<{ x: number; y: number } | null>(null);

  /**
   * Translate a DOM pointer position into a scene ray.
   *
   * Measures the CANVAS, not the frame: the frame also contains the camera
   * controls strip, so using its rect would skew u/v and silently bias every
   * pick toward the top of the scene.
   */
  const rayAt = React.useCallback((clientX: number, clientY: number) => {
    const current = pick.current;
    const canvas = frameRef.current?.querySelector("canvas");
    if (!current || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (
      clientX < rect.left || clientX > rect.right ||
      clientY < rect.top || clientY > rect.bottom
    ) return null;
    const point = pointerToUV(clientX, clientY, rect);
    return point ? current(point) : null;
  }, []);

  // CAPTURE phase, not bubble. use.gpu's canvas owns pointer input for
  // OrbitControls and consumes pointerdown/pointerup before they reach an
  // ancestor, so bubble-phase handlers see hover but never a click. Capturing
  // observes the events on the way down without taking them away from the
  // camera, so orbiting still works.
  const handlers = onPick
    ? {
      onPointerMoveCapture: (event: React.PointerEvent) => {
        onPick(rayAt(event.clientX, event.clientY), "hover");
      },
      onPointerLeave: () => onPick(null, "hover"),
      onPointerDownCapture: (event: React.PointerEvent) => {
        pressAt.current = { x: event.clientX, y: event.clientY };
      },
      onPointerUpCapture: (event: React.PointerEvent) => {
        const down = pressAt.current;
        pressAt.current = null;
        // A drag that ends over the scene is an orbit, not a selection.
        if (
          !down ||
          Math.abs(event.clientX - down.x) > CLICK_SLOP_PX ||
          Math.abs(event.clientY - down.y) > CLICK_SLOP_PX
        ) return;
        onPick(rayAt(event.clientX, event.clientY), "select");
      },
    }
    : {};

  return (
    <ChartErrorBoundary>
      <div
        ref={frameRef}
        data-chart-surface="webgpu-3d"
        role="group"
        aria-label={label}
        style={styles.frame}
        {...handlers}
      >
        <LiveCanvas key={cameraEpoch}>
          {(canvas: HTMLCanvasElement) => (
            <Scene3D
              canvas={canvas}
              spec={spec}
              prismInstances={prismInstances}
              publishPick={onPick ? publishPick : undefined}
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
