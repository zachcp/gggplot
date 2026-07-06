import React from "react";
import { LiveCanvas } from "@use-gpu/react";
import type { GGSpec } from "@gggplot/core";
import { Scene } from "./scene.tsx";

/** React host for the WebGPU Live plot scene. */
export function ChartCanvas({ spec }: { spec: GGSpec }) {
  return (
    <div style={styles.frame}>
      <LiveCanvas>
        {(canvas: HTMLCanvasElement) => <Scene canvas={canvas} spec={spec} />}
      </LiveCanvas>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  frame: {
    width: "100%",
    height: 360,
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #1e1e30",
    background: "#0a0a12",
  },
};
