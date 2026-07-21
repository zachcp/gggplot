/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
// UseGPU Live scene hosting a 3D gggplot node: OrbitCamera (3D perspective
// view; scale sizes the projection) → Pass → GGPlot3D (FontLoader → Plot →
// Cartesian → Point). The camera projects the data-space points on the GPU.
import { createElement, Fragment } from "@use-gpu/live";
import { AutoCanvas, WebGPU } from "@use-gpu/webgpu";
import { OrbitCamera, Pass } from "@use-gpu/workbench";
import { compile3d, orbitCameraProps } from "@gggplot/core/geom_3d";
import type { Point3DSpec } from "@gggplot/core/geom_3d";
import { GGPlot3D } from "@gggplot/core/geom_3d/render";

interface Props {
  canvas: HTMLCanvasElement;
  spec: Point3DSpec;
}

export const Scene3D = ({ canvas, spec }: Props) => {
  const node = compile3d(spec);
  const orbit = orbitCameraProps(spec.camera);
  return (
    <WebGPU fallback={null}>
      <AutoCanvas canvas={canvas} backgroundColor={[0.05, 0.05, 0.07, 1]}>
        <OrbitCamera
          bearing={orbit.bearing}
          pitch={orbit.pitch}
          radius={orbit.radius}
          target={orbit.target}
          fov={orbit.fov}
          near={orbit.near}
          far={orbit.far}
          scale={2160}
        >
          <Pass>
            <GGPlot3D node={node} />
          </Pass>
        </OrbitCamera>
      </AutoCanvas>
    </WebGPU>
  );
};
