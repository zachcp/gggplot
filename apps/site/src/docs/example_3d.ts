import { compile3d, emitPoint3dSource } from "@gggplot/core/geom_3d";
import type { Point3DSpec } from "@gggplot/core/geom_3d";

// A helix: x/z trace a circle while y climbs, so depth is unambiguous under a
// perspective camera. Colored by height band to exercise mapped 3D colors.
const N = 160;
const x: number[] = [];
const y: number[] = [];
const z: number[] = [];
// geom_3d has no discrete color scale yet (that is gggplot-4q2.3), so the demo
// supplies hex colors directly — packColorsRGBA consumes hex, exactly like the
// 2D packer. A height-band palette keeps the helix's depth readable.
const col: string[] = [];
for (let i = 0; i < N; i++) {
  const t = (i / (N - 1)) * Math.PI * 6;
  const height = i / (N - 1);
  x.push(Math.cos(t));
  z.push(Math.sin(t));
  y.push(height * 2 - 1);
  col.push(height < 1 / 3 ? "#60a5fa" : height < 2 / 3 ? "#f59e0b" : "#ef4444");
}

export const helix3dSpec: Point3DSpec = {
  geom: "point_3d",
  data: { x, y, z, col },
  mapping: { x: "x", y: "y", z: "z", color: "col" },
  camera: {
    projection: "perspective",
    position: [2.6, 1.8, 2.6],
    target: [0, 0, 0],
    fovY: Math.PI / 4,
  },
  params: { size: 24 },
};

export const helix3dDslSource =
  `// geom_point_3d: flat vec4 positions, GPU camera projection
ggplot3d(data, { x: "x", y: "y", z: "z", color: "col" })
  .add(geomPoint3d({ size: 24 }))
  .add(coordCamera({ position: [2.6, 1.8, 2.6], target: [0, 0, 0] }))
  .build();`;

// Real output of the geom_3d pipeline: lower the spec, then emit standalone
// use.gpu source. Shown in the docs as concrete proof the geom compiles and
// emits valid 3D source (the in-browser live render is WIP; gggplot-4q2.6).
const helix3dNode = compile3d(helix3dSpec);
export const helix3dEmitted = emitPoint3dSource(helix3dNode, "Helix3D");
export const helix3dSummary =
  `${helix3dNode.positions.length} points packed into a ${helix3dNode.positions.format} FlatTensor; ` +
  `data ranges x=[${
    helix3dNode.range[0].map((v) => v.toFixed(2)).join(", ")
  }], ` +
  `y=[${helix3dNode.range[1].map((v) => v.toFixed(2)).join(", ")}], ` +
  `z=[${helix3dNode.range[2].map((v) => v.toFixed(2)).join(", ")}]; ` +
  `camera lowered to a 16-element view·projection matrix.`;
