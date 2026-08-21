import {
  compile,
  coordCartesian,
  emitSource,
  geomPath,
  geomPoint,
  geomSegment,
  ggplot,
  type GGSpec,
  labels,
  scaleXContinuous,
  scaleYContinuous,
  scaleZContinuous,
  theme,
} from "@gggplot/core";
import type { ThreeDShowcase } from "./types.ts";

function showcase(
  id: string,
  title: string,
  description: string,
  dslSource: string,
  spec: GGSpec,
): ThreeDShowcase {
  const tree = compile(spec);
  const cartesian = tree.children[0].children[0];
  // The first node carrying positions, rather than a Point specifically: a
  // segment showcase has Line marks and no points at all.
  const point = cartesian.children.find((node) =>
    node.props.positions != null
  )!;
  const ranges = cartesian.props.range as [number, number][];
  const positions = point.props.positions as { length: number; format: string };
  const count = (component: string) =>
    cartesian.children.filter((node) => node.component === component).length;
  return {
    id,
    title,
    description,
    dslSource,
    spec,
    emitted: emitSource(tree, id),
    summary:
      `${positions.length} vertices packed into a ${positions.format} FlatTensor; ` +
      `data ranges x=[${ranges[0].join(", ")}], y=[${ranges[1].join(", ")}], ` +
      `z=[${ranges[2].join(", ")}]; ${count("Axis")} in-scene axes, ` +
      `${count("Grid")} coordinate-plane grids, ` +
      `${tree.children[1].children.length} screen-space overlay nodes; ` +
      `one canonical plot camera seeds the live orbit controls.`,
  };
}

const N = 160;
const helixX: number[] = [];
const helixY: number[] = [];
const helixZ: number[] = [];
const band: string[] = [];
for (let i = 0; i < N; i++) {
  const t = (i / (N - 1)) * Math.PI * 6;
  const height = i / (N - 1);
  helixX.push(Math.cos(t));
  helixZ.push(Math.sin(t));
  helixY.push(height * 2 - 1);
  band.push(height < 1 / 3 ? "low" : height < 2 / 3 ? "mid" : "high");
}

export const helix3dSpec = ggplot(
  { x: helixX, y: helixY, z: helixZ, band },
  { x: "x", y: "y", z: "z", color: "band" },
).add(
  geomPath({ linewidth: 3, alpha: 0.7 }),
  geomPoint({ size: 24 }),
  labels({
    title: "Helix",
    subtitle: "x/z trace a circle while y climbs",
    x: "cos(t)",
    y: "height",
    z: "sin(t)",
    color: "band",
  }),
).build();

const helix3d = showcase(
  "Helix3D",
  "3D helix point cloud",
  "160 points and grouped 3D paths tracing a helix, colored by height band. In-scene axes and grids orbit with the cube; the legend and title stay flat on screen.",
  `const spec = ggplot(data, aes({ x: "x", y: "y", z: "z", color: "band" }))
  .add(
    geomPath({ linewidth: 3, alpha: 0.7 }),
    geomPoint({ size: 24 }),
    labels({ title: "Helix", z: "sin(t)", color: "band" }),
  )
  .build();
// No camera3d() is needed: the standard three-quarter view is the default.
compile(spec);`,
  helix3dSpec,
);

const latX: number[] = [];
const latY: number[] = [];
const latZ: number[] = [];
const radius: number[] = [];
const STEPS = 6;
for (let i = 0; i < STEPS; i++) {
  for (let j = 0; j < STEPS; j++) {
    for (let k = 0; k < STEPS; k++) {
      const x = i / (STEPS - 1) * 2 - 1;
      const y = j / (STEPS - 1) * 2 - 1;
      const z = k / (STEPS - 1) * 2 - 1;
      latX.push(x);
      latY.push(y);
      latZ.push(z);
      radius.push(Math.sqrt(x * x + y * y + z * z));
    }
  }
}

export const lattice3dSpec = ggplot(
  { x: latX, y: latY, z: latZ, radius },
  { x: "x", y: "y", z: "z", color: "radius" },
).add(
  geomPoint({ size: 16, alpha: 0.85, sizeMode: "perspective" }),
  labels({ title: "Lattice", color: "distance from origin" }),
).build();

const lattice3d = showcase(
  "Lattice3D",
  "Perspective sizing and a continuous colorbar",
  "A 6x6x6 lattice colored by distance from the origin. sizeMode 'perspective' is the explicit world-space sizing override.",
  `ggplot(data, aes({ x: "x", y: "y", z: "z", color: "radius" }))
  .add(
    geomPoint({ size: 16, alpha: 0.85, sizeMode: "perspective" }),
    labels({ title: "Lattice", color: "distance from origin" }),
  );`,
  lattice3dSpec,
);

const treatments = ["control", "low dose", "high dose"];
const catX: string[] = [];
const catY: number[] = [];
const catZ: number[] = [];
const replicate: string[] = [];
for (let i = 0; i < treatments.length; i++) {
  for (let j = 0; j < 24; j++) {
    const angle = j / 24 * Math.PI * 2;
    catX.push(treatments[i]);
    catY.push(1 + i * 0.6 + Math.sin(angle) * 0.35);
    catZ.push(Math.cos(angle) * (0.4 + i * 0.2));
    replicate.push(j % 2 === 0 ? "batch A" : "batch B");
  }
}

export const categorical3dSpec = ggplot(
  { x: catX, y: catY, z: catZ, replicate },
  { x: "x", y: "y", z: "z", color: "replicate" },
).add(
  geomPoint({ size: 18 }),
  labels({ title: "Discrete x", x: "treatment", y: "response", z: "offset" }),
).build();

const categorical3d = showcase(
  "Categorical3D",
  "A discrete position axis in 3D",
  "A string column on x trains the same discrete position scale used in 2D, with named level ticks.",
  `ggplot(data, aes({ x: "treatment", y: "response", z: "offset" }))
  .add(geomPoint({ size: 18 }), labels({ title: "Discrete x" }));`,
  categorical3dSpec,
);

export const swizzled3dSpec = ggplot(
  { x: helixX, y: helixY, z: helixZ, band },
  { x: "x", y: "y", z: "z", color: "band" },
).add(
  geomPoint({ size: 24 }),
  coordCartesian({ axes: "xzy" }),
  scaleXContinuous({ nBreaks: 3 }),
  scaleYContinuous({ nBreaks: 3 }),
  scaleZContinuous({ nBreaks: 3 }),
  theme({ grid: false }),
  labels({ title: "coord axes = xzy", color: "band" }),
).build();

const swizzled3d = showcase(
  "Swizzled3D",
  "coord swizzle, grid off",
  "The same helix under the xzy output-axis swizzle, with the ordinary theme grid switch disabled and three scale breaks per axis.",
  `ggplot(data, aes({ x: "x", y: "y", z: "z", color: "band" }))
  .add(
    geomPoint({ size: 24 }),
    coordCartesian({ axes: "xzy" }),
    scaleZContinuous({ nBreaks: 3 }),
    theme({ grid: false }),
  );`,
  swizzled3dSpec,
);

// A small vector field: each row is one segment from a lattice site along a
// swirl direction, which is the shape geom_segment's six mapped positions are
// actually for.
const fieldX: number[] = [];
const fieldY: number[] = [];
const fieldZ: number[] = [];
const fieldXend: number[] = [];
const fieldYend: number[] = [];
const fieldZend: number[] = [];
const speed: number[] = [];
for (let i = 0; i < 5; i++) {
  for (let j = 0; j < 5; j++) {
    for (let k = 0; k < 3; k++) {
      const x = i / 4 * 2 - 1;
      const y = j / 4 * 2 - 1;
      const z = k / 2 * 2 - 1;
      // A swirl about the vertical axis, scaled down so arrows stay readable.
      const dx = -y * 0.35;
      const dy = x * 0.35;
      const dz = 0.18;
      fieldX.push(x);
      fieldY.push(y);
      fieldZ.push(z);
      fieldXend.push(x + dx);
      fieldYend.push(y + dy);
      fieldZend.push(z + dz);
      speed.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
  }
}

export const segments3dSpec = ggplot(
  {
    x: fieldX,
    y: fieldY,
    z: fieldZ,
    xend: fieldXend,
    yend: fieldYend,
    zend: fieldZend,
    speed,
  },
  {
    x: "x",
    y: "y",
    z: "z",
    xend: "xend",
    yend: "yend",
    zend: "zend",
  },
).add(
  geomSegment({ strokeWidth: 2, color: "#38bdf8" }),
  labels({ title: "Vector field", x: "x", y: "y", z: "z" }),
).build();

const segments3d = showcase(
  "Segments3D",
  "3D segments from six mapped positions",
  "A swirl field drawn as one disjoint segment per row. The 3D mode needs all six positions mapped — x/y/z and xend/yend/zend — and zend trains the z scale exactly as xend trains x, so the far endpoints stay inside the cube.",
  `ggplot(data, aes({
  x: "x", y: "y", z: "z",
  xend: "xend", yend: "yend", zend: "zend",
}))
  .add(geomSegment({ strokeWidth: 2, color: "#38bdf8" }));
// Mapping z without zend reports the missing aesthetic rather than
// silently dropping back to a 2D plot.`,
  segments3dSpec,
);

export const threeDShowcases: ThreeDShowcase[] = [
  helix3d,
  lattice3d,
  categorical3d,
  segments3d,
  swizzled3d,
];

export const helix3dDslSource = helix3d.dslSource;
export const helix3dEmitted = helix3d.emitted;
export const helix3dSummary = helix3d.summary;
