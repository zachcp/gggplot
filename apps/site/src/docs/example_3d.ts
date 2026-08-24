import {
  compile,
  coordCartesian,
  emitSource,
  geomCol,
  geomPath,
  geomPoint,
  geomPolygon,
  geomRibbon,
  geomSegment,
  geomSurface,
  geomText,
  geomVoxel,
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

// --- Prisms: geom_col in 3D -------------------------------------------------

const quarters = ["Q1", "Q2", "Q3", "Q4"];
const regions = ["north", "south", "east"];
const prismX: string[] = [];
const prismY: number[] = [];
const prismZ: string[] = [];
const prismSeries: string[] = [];
for (const [qi, quarter] of quarters.entries()) {
  for (const [ri, region] of regions.entries()) {
    for (const series of ["direct", "channel"]) {
      prismX.push(quarter);
      prismZ.push(region);
      prismSeries.push(series);
      prismY.push(
        1 + Math.abs(Math.sin(qi * 1.3 + ri)) * (series === "direct" ? 2 : 1.2),
      );
    }
  }
}

export const prisms3dSpec = ggplot(
  { x: prismX, y: prismY, z: prismZ, series: prismSeries },
  { x: "x", y: "y", z: "z", fill: "series" },
).add(
  geomCol(),
  labels({
    title: "Stacked prisms",
    x: "quarter",
    y: "revenue",
    z: "region",
    fill: "series",
  }),
).build();

const prisms3d = showcase(
  "Prisms3D",
  "3D columns over a two-axis footprint",
  "geom_col in 3D is a distinct primitive, not a z extension: a 2D bar has one categorical axis and one measured extent, while a prism has two. z places each column and a zwidth param gives it thickness, defaulting to the scale resolution exactly as width does on x. Stacking accumulates within an (x, z) footprint cell rather than along x alone.",
  `ggplot(data, aes({ x: "quarter", y: "revenue", z: "region", fill: "series" }))
  .add(geomCol());
// zwidth defaults from the z scale; pass it to override the slab thickness.
// geom_bar has no 3D mode — a count has no per-(x, z) meaning.`,
  prisms3dSpec,
);

// --- Voxels: stat_bin_3d + geom_voxel ---------------------------------------

const cloudX: number[] = [];
const cloudY: number[] = [];
const cloudZ: number[] = [];
let seed = 7;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
for (let i = 0; i < 900; i++) {
  // Two overlapping blobs, so occupancy varies across the lattice.
  const blob = i % 3 === 0 ? 0.6 : -0.4;
  cloudX.push(blob + (rand() - 0.5) * 1.1);
  cloudY.push(blob * 0.5 + (rand() - 0.5) * 1.1);
  cloudZ.push(-blob + (rand() - 0.5) * 1.1);
}

export const voxels3dSpec = ggplot(
  { x: cloudX, y: cloudY, z: cloudZ },
  { x: "x", y: "y", z: "z" },
).add(
  geomVoxel({ bins: 7, padding: 0.15 }),
  labels({ title: "Occupancy voxels", fill: "count" }),
).build();

const voxels3d = showcase(
  "Voxels3D",
  "Sparse 3D binning",
  "stat_bin_3d counts observations into lattice cells and geom_voxel draws the occupied ones. The product is sparse: empty cells are dropped, so absence means no observations landed there rather than a count of zero. padding shrinks each cell toward its center so individual bins stay legible in a dense lattice.",
  `ggplot(data, aes({ x: "x", y: "y", z: "z" }))
  .add(geomVoxel({ bins: 7, padding: 0.15 }));
// fill defaults to the computed count. density divides by cell VOLUME.`,
  voxels3dSpec,
);

// --- Height field: geom_surface ---------------------------------------------

const gridX: number[] = [];
const gridY: number[] = [];
const gridZ: number[] = [];
const GRID = 14;
for (let j = 0; j < GRID; j++) {
  for (let i = 0; i < GRID; i++) {
    const x = (i / (GRID - 1)) * 4 - 2;
    const y = (j / (GRID - 1)) * 4 - 2;
    gridX.push(x);
    gridY.push(y);
    // A ripple, with one cell punched out to show a hole rather than a patch.
    gridZ.push(
      i === 4 && j === 4
        ? (null as unknown as number)
        : Math.cos(Math.sqrt(x * x + y * y) * 2) * 0.6,
    );
  }
}

export const surface3dSpec = ggplot(
  { x: gridX, y: gridY, z: gridZ },
  { x: "x", y: "y", z: "z" },
).add(
  geomSurface({ fill: "#38bdf8", alpha: 0.85 }),
  labels({ title: "Height field", x: "x", y: "y", z: "height" }),
).build();

const surface3d = showcase(
  "Surface3D",
  "A grid-connected height field",
  "geom_surface triangulates z = f(x, y) by grid adjacency. The grid contract is enforced rather than inferred: every combination of the distinct x and y values must appear exactly once, and scattered points are refused instead of being triangulated. One cell here has a missing z, which leaves a visible hole — the quads touching it are dropped rather than interpolated across, since bridging the gap would fabricate terrain.",
  `ggplot(grid, aes({ x: "x", y: "y", z: "height" }))
  .add(geomSurface({ fill: "#38bdf8", alpha: 0.85 }));
// A missing z leaves a hole. Scattered input fails with the row count
// a complete grid would have needed.`,
  surface3dSpec,
);

// --- Planar surfaces: polygon, ribbon, rect ---------------------------------

const planeX: number[] = [];
const planeY: number[] = [];
const planeZ: number[] = [];
const planeGroup: string[] = [];
for (const [index, depth] of [-1, 0, 1].entries()) {
  const radius = 1 - index * 0.2;
  for (let k = 0; k < 6; k++) {
    const angle = (k / 6) * Math.PI * 2;
    planeX.push(Math.cos(angle) * radius);
    planeY.push(Math.sin(angle) * radius);
    planeZ.push(depth);
    planeGroup.push(`plane ${index + 1}`);
  }
}

export const planes3dSpec = ggplot(
  { x: planeX, y: planeY, z: planeZ, plane: planeGroup },
  { x: "x", y: "y", z: "z", group: "plane", fill: "plane" },
).add(
  geomPolygon({ alpha: 0.55 }),
  labels({ title: "Planar surfaces", fill: "plane" }),
).build();

const planes3d = showcase(
  "Planes3D",
  "Planes embedded in 3D, with no implied volume",
  "Vertex z positions the plane; nothing is extruded. Three hexagonal rings sit at three depths, translucent so the ones behind stay visible. A ring with any missing vertex is dropped whole rather than closed across the gap, which would invent area the data never had.",
  `ggplot(data, aes({ x: "x", y: "y", z: "z", group: "plane", fill: "plane" }))
  .add(geomPolygon({ alpha: 0.55 }));
// geom_area, geom_ribbon, and geom_rect share this path. A ribbon between
// two z values is TWO surfaces, never a solid.`,
  planes3dSpec,
);

// --- Bands: geom_ribbon in 3D -----------------------------------------------

const bandX: number[] = [];
const bandLow: number[] = [];
const bandHigh: number[] = [];
const bandZ: number[] = [];
const bandSeries: string[] = [];
for (const [index, depth] of [-0.8, 0, 0.8].entries()) {
  for (let i = 0; i < 24; i++) {
    const t = (i / 23) * Math.PI * 2;
    bandX.push((i / 23) * 4 - 2);
    const center = Math.sin(t + index) * 0.6;
    bandLow.push(center - 0.25);
    bandHigh.push(center + 0.25);
    bandZ.push(depth);
    bandSeries.push(`series ${index + 1}`);
  }
}

export const bands3dSpec = ggplot(
  {
    x: bandX,
    ymin: bandLow,
    ymax: bandHigh,
    z: bandZ,
    series: bandSeries,
  },
  { x: "x", ymin: "ymin", ymax: "ymax", z: "z", group: "series", fill: "series" },
).add(
  geomRibbon({ alpha: 0.6 }),
  labels({ title: "Bands at depth", x: "t", y: "value", fill: "series" }),
).build();

const bands3d = showcase(
  "Bands3D",
  "Uncertainty bands stacked in depth",
  "Each ribbon is one surface walking its upper edge and back along the lower one, standing in the plane at its own z. It does not fill down to a z floor, because the grammar has not chosen a floor — a 3D band is a surface, not a solid.",
  `ggplot(data, aes({
  x: "t", ymin: "lo", ymax: "hi", z: "depth", group: "series",
}))
  .add(geomRibbon({ alpha: 0.6 }));`,
  bands3dSpec,
);

// --- Billboards: geom_text in 3D --------------------------------------------

const markerX = [-1, 1, 0, 0, 0.8];
const markerY = [0, 0, 1, -1, 0.8];
const markerZ = [0, 0, 0.6, -0.6, 1.2];
const markerLabel = ["west", "east", "up", "down", "corner"];

export const labels3dSpec = ggplot(
  { x: markerX, y: markerY, z: markerZ, label: markerLabel },
  { x: "x", y: "y", z: "z", label: "label" },
).add(
  geomPoint({ size: 20 }),
  geomText({ size: 15, color: "#f8fafc" }),
  labels({ title: "3D billboards" }),
).build();

const labels3d = showcase(
  "Labels3D",
  "Camera-facing text at world anchors",
  "geom_text in 3D anchors glyphs at vec4 world positions and lets the renderer keep them facing the camera. Size is pixel-constant by default so labels stay legible at any distance, with sizeMode 'perspective' as the explicit world-space opt-in. geom_label has no 3D mode: its background box is measured in CSS pixels, which has no meaning under a perspective camera.",
  `ggplot(data, aes({ x: "x", y: "y", z: "z", label: "label" }))
  .add(geomPoint({ size: 20 }), geomText({ size: 15 }));
// Labels always face the camera — there is no billboard: false.`,
  labels3dSpec,
);

export const threeDShowcases: ThreeDShowcase[] = [
  helix3d,
  lattice3d,
  categorical3d,
  segments3d,
  labels3d,
  planes3d,
  bands3d,
  prisms3d,
  surface3d,
  voxels3d,
  swizzled3d,
];

export const helix3dDslSource = helix3d.dslSource;
export const helix3dEmitted = helix3d.emitted;
export const helix3dSummary = helix3d.summary;
