/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// 3D showcases, written as component JSX (gggplot-vnh.10.1): mapping z on an
// ordinary geom selects its 3D mode. See examples_basics.tsx for the
// chart/jsxSource convention; <SitePlot3D> is shown as <GGPlot>.
import * as Jsx from "@gggplot/core/jsx";
import type { LiveElement } from "@use-gpu/live";
import {
  CoordCartesian,
  GeomCol,
  GeomPath,
  GeomPoint,
  GeomPolygon,
  GeomRibbon,
  GeomSegment,
  GeomSurface,
  GeomText,
  GeomVoxel,
  Labs,
  ScaleXContinuous,
  ScaleYContinuous,
  ScaleZContinuous,
  ThemeOverrides,
} from "@gggplot/core";
import { SitePlot3D } from "../site_plot.tsx";
import type { ThreeDShowcase } from "./types.ts";

function showcase(
  id: string,
  showcase: {
    title: string;
    description: string;
    jsxSource: string;
    chart: () => LiveElement;
  },
): ThreeDShowcase {
  return { id, ...showcase };
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

export const helixData = { x: helixX, y: helixY, z: helixZ, band };

const helix3d = showcase("Helix3D", {
  title: "3D helix point cloud",
  description:
    "160 points and grouped 3D paths tracing a helix, colored by height band. In-scene axes and grids orbit with the cube; the legend and title stay flat on screen. No camera part is needed: the standard three-quarter view is the default.",
  jsxSource:
    `<GGPlot data={helixData} mapping={{ x: "x", y: "y", z: "z", color: "band" }}>
  <GeomPath linewidth={3} alpha={0.7} />
  <GeomPoint size={24} />
  <Labs
    title="Helix"
    subtitle="x/z trace a circle while y climbs"
    x="cos(t)"
    y="height"
    z="sin(t)"
    color="band"
  />
</GGPlot>`,
  chart: () => (
    <SitePlot3D
      data={helixData}
      mapping={{ x: "x", y: "y", z: "z", color: "band" }}
    >
      <GeomPath linewidth={3} alpha={0.7} />
      <GeomPoint size={24} />
      <Labs
        title="Helix"
        subtitle="x/z trace a circle while y climbs"
        x="cos(t)"
        y="height"
        z="sin(t)"
        color="band"
      />
    </SitePlot3D>
  ),
});

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

const latticeData = { x: latX, y: latY, z: latZ, radius };

const lattice3d = showcase("Lattice3D", {
  title: "Perspective sizing and a continuous colorbar",
  description:
    "A 6x6x6 lattice colored by distance from the origin. sizeMode 'perspective' is the explicit world-space sizing override.",
  jsxSource: `<GGPlot
  data={latticeData}
  mapping={{ x: "x", y: "y", z: "z", color: "radius" }}
>
  <GeomPoint size={16} alpha={0.85} sizeMode="perspective" />
  <Labs title="Lattice" color="distance from origin" />
</GGPlot>`,
  chart: () => (
    <SitePlot3D
      data={latticeData}
      mapping={{ x: "x", y: "y", z: "z", color: "radius" }}
    >
      <GeomPoint size={16} alpha={0.85} sizeMode="perspective" />
      <Labs title="Lattice" color="distance from origin" />
    </SitePlot3D>
  ),
});

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

const categoricalData = { x: catX, y: catY, z: catZ, replicate };

const categorical3d = showcase("Categorical3D", {
  title: "A discrete position axis in 3D",
  description:
    "A string column on x trains the same discrete position scale used in 2D, with named level ticks.",
  jsxSource: `<GGPlot
  data={categoricalData}
  mapping={{ x: "x", y: "y", z: "z", color: "replicate" }}
>
  <GeomPoint size={18} />
  <Labs title="Discrete x" x="treatment" y="response" z="offset" />
</GGPlot>`,
  chart: () => (
    <SitePlot3D
      data={categoricalData}
      mapping={{ x: "x", y: "y", z: "z", color: "replicate" }}
    >
      <GeomPoint size={18} />
      <Labs title="Discrete x" x="treatment" y="response" z="offset" />
    </SitePlot3D>
  ),
});

const swizzled3d = showcase("Swizzled3D", {
  title: "coord swizzle, grid off",
  description:
    "The same helix under the xzy output-axis swizzle, with the ordinary theme grid switch disabled and three scale breaks per axis.",
  jsxSource:
    `<GGPlot data={helixData} mapping={{ x: "x", y: "y", z: "z", color: "band" }}>
  <GeomPoint size={24} />
  <CoordCartesian axes="xzy" />
  <ScaleXContinuous nBreaks={3} />
  <ScaleYContinuous nBreaks={3} />
  <ScaleZContinuous nBreaks={3} />
  <ThemeOverrides grid={false} />
  <Labs title="coord axes = xzy" color="band" />
</GGPlot>`,
  chart: () => (
    <SitePlot3D
      data={helixData}
      mapping={{ x: "x", y: "y", z: "z", color: "band" }}
    >
      <GeomPoint size={24} />
      <CoordCartesian axes="xzy" />
      <ScaleXContinuous nBreaks={3} />
      <ScaleYContinuous nBreaks={3} />
      <ScaleZContinuous nBreaks={3} />
      <ThemeOverrides grid={false} />
      <Labs title="coord axes = xzy" color="band" />
    </SitePlot3D>
  ),
});

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

const fieldData = {
  x: fieldX,
  y: fieldY,
  z: fieldZ,
  xend: fieldXend,
  yend: fieldYend,
  zend: fieldZend,
  speed,
};

const segments3d = showcase("Segments3D", {
  title: "3D segments from six mapped positions",
  description:
    "A swirl field drawn as one disjoint segment per row. The 3D mode needs all six positions mapped — x/y/z and xend/yend/zend — and zend trains the z scale exactly as xend trains x, so the far endpoints stay inside the cube. Mapping z without zend reports the missing aesthetic rather than silently dropping back to a 2D plot.",
  jsxSource: `<GGPlot
  data={fieldData}
  mapping={{
    x: "x",
    y: "y",
    z: "z",
    xend: "xend",
    yend: "yend",
    zend: "zend",
  }}
>
  <GeomSegment strokeWidth={2} color="#38bdf8" />
  <Labs title="Vector field" x="x" y="y" z="z" />
</GGPlot>`,
  chart: () => (
    <SitePlot3D
      data={fieldData}
      mapping={{
        x: "x",
        y: "y",
        z: "z",
        xend: "xend",
        yend: "yend",
        zend: "zend",
      }}
    >
      <GeomSegment strokeWidth={2} color="#38bdf8" />
      <Labs title="Vector field" x="x" y="y" z="z" />
    </SitePlot3D>
  ),
});

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

const prismData = { x: prismX, y: prismY, z: prismZ, series: prismSeries };

const prisms3d = showcase("Prisms3D", {
  title: "3D columns over a two-axis footprint",
  description:
    "geom_col in 3D is a distinct primitive, not a z extension: a 2D bar has one categorical axis and one measured extent, while a prism has two. z places each column and a zwidth param gives it thickness, defaulting to the scale resolution exactly as width does on x. Stacking accumulates within an (x, z) footprint cell rather than along x alone. geom_bar has no 3D mode: a count has no per-(x, z) meaning.",
  jsxSource:
    `<GGPlot data={prismData} mapping={{ x: "x", y: "y", z: "z", fill: "series" }}>
  <GeomCol />
  <Labs
    title="Stacked prisms"
    x="quarter"
    y="revenue"
    z="region"
    fill="series"
  />
</GGPlot>`,
  chart: () => (
    <SitePlot3D
      data={prismData}
      mapping={{ x: "x", y: "y", z: "z", fill: "series" }}
    >
      <GeomCol />
      <Labs
        title="Stacked prisms"
        x="quarter"
        y="revenue"
        z="region"
        fill="series"
      />
    </SitePlot3D>
  ),
});

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

const cloudData = { x: cloudX, y: cloudY, z: cloudZ };

const voxels3d = showcase("Voxels3D", {
  title: "Sparse 3D binning",
  description:
    "stat_bin_3d counts observations into lattice cells and geom_voxel draws the occupied ones. The product is sparse: empty cells are dropped, so absence means no observations landed there rather than a count of zero. padding shrinks each cell toward its center so individual bins stay legible in a dense lattice; fill defaults to the computed count, and density divides by cell VOLUME. Setting alpha below 1 is an accepted trade-off rather than a free option: cells inside one draw call blend in packing order, not back-to-front, which shifts the composited intensity of overlapping cells by up to ~64 of 255 levels. Since fill encodes count, that intensity is itself a data channel, so read exact counts from the legend rather than from how dark a cell looks. Opaque voxels are ordered correctly by the depth buffer and are unaffected.",
  jsxSource: `<GGPlot data={cloudData} mapping={{ x: "x", y: "y", z: "z" }}>
  <GeomVoxel bins={7} padding={0.15} />
  <Labs title="Occupancy voxels" fill="count" />
</GGPlot>`,
  chart: () => (
    <SitePlot3D data={cloudData} mapping={{ x: "x", y: "y", z: "z" }}>
      <GeomVoxel bins={7} padding={0.15} />
      <Labs title="Occupancy voxels" fill="count" />
    </SitePlot3D>
  ),
});

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

const heightField = { x: gridX, y: gridY, z: gridZ };

const surface3d = showcase("Surface3D", {
  title: "A grid-connected height field",
  description:
    "geom_surface triangulates z = f(x, y) by grid adjacency. The grid contract is enforced rather than inferred: every combination of the distinct x and y values must appear exactly once, and scattered points are refused (with the row count a complete grid would have needed) instead of being triangulated. One cell here has a missing z, which leaves a visible hole — the quads touching it are dropped rather than interpolated across, since bridging the gap would fabricate terrain.",
  jsxSource: `<GGPlot data={heightField} mapping={{ x: "x", y: "y", z: "z" }}>
  <GeomSurface fill="#38bdf8" alpha={0.85} />
  <Labs title="Height field" x="x" y="y" z="height" />
</GGPlot>`,
  chart: () => (
    <SitePlot3D data={heightField} mapping={{ x: "x", y: "y", z: "z" }}>
      <GeomSurface fill="#38bdf8" alpha={0.85} />
      <Labs title="Height field" x="x" y="y" z="height" />
    </SitePlot3D>
  ),
});

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

const planeData = { x: planeX, y: planeY, z: planeZ, plane: planeGroup };

const planes3d = showcase("Planes3D", {
  title: "Planes embedded in 3D, with no implied volume",
  description:
    "Vertex z positions the plane; nothing is extruded. Three hexagonal rings sit at three depths, translucent so the ones behind stay visible. A ring with any missing vertex is dropped whole rather than closed across the gap, which would invent area the data never had. geom_area, geom_ribbon and geom_rect share this path: a ribbon between two z values is TWO surfaces, never a solid.",
  jsxSource: `<GGPlot
  data={planeData}
  mapping={{ x: "x", y: "y", z: "z", group: "plane", fill: "plane" }}
>
  <GeomPolygon alpha={0.55} />
  <Labs title="Planar surfaces" fill="plane" />
</GGPlot>`,
  chart: () => (
    <SitePlot3D
      data={planeData}
      mapping={{ x: "x", y: "y", z: "z", group: "plane", fill: "plane" }}
    >
      <GeomPolygon alpha={0.55} />
      <Labs title="Planar surfaces" fill="plane" />
    </SitePlot3D>
  ),
});

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

const bandData3d = {
  x: bandX,
  ymin: bandLow,
  ymax: bandHigh,
  z: bandZ,
  series: bandSeries,
};

const bands3d = showcase("Bands3D", {
  title: "Uncertainty bands stacked in depth",
  description:
    "Each ribbon is one surface walking its upper edge and back along the lower one, standing in the plane at its own z. It does not fill down to a z floor, because the grammar has not chosen a floor — a 3D band is a surface, not a solid.",
  jsxSource: `<GGPlot
  data={bandData3d}
  mapping={{
    x: "x",
    ymin: "ymin",
    ymax: "ymax",
    z: "z",
    group: "series",
    fill: "series",
  }}
>
  <GeomRibbon alpha={0.6} />
  <Labs title="Bands at depth" x="t" y="value" fill="series" />
</GGPlot>`,
  chart: () => (
    <SitePlot3D
      data={bandData3d}
      mapping={{
        x: "x",
        ymin: "ymin",
        ymax: "ymax",
        z: "z",
        group: "series",
        fill: "series",
      }}
    >
      <GeomRibbon alpha={0.6} />
      <Labs title="Bands at depth" x="t" y="value" fill="series" />
    </SitePlot3D>
  ),
});

// --- Billboards: geom_text in 3D --------------------------------------------

const markerX = [-1, 1, 0, 0, 0.8];
const markerY = [0, 0, 1, -1, 0.8];
const markerZ = [0, 0, 0.6, -0.6, 1.2];
const markerLabel = ["west", "east", "up", "down", "corner"];

const markerData = { x: markerX, y: markerY, z: markerZ, label: markerLabel };

const labels3d = showcase("Labels3D", {
  title: "Camera-facing text at world anchors",
  description:
    "geom_text in 3D anchors glyphs at vec4 world positions and lets the renderer keep them facing the camera. Size is pixel-constant by default so labels stay legible at any distance, with sizeMode 'perspective' as the explicit world-space opt-in. geom_label has no 3D mode: its background box is measured in CSS pixels, which has no meaning under a perspective camera.",
  jsxSource:
    `<GGPlot data={markerData} mapping={{ x: "x", y: "y", z: "z", label: "label" }}>
  <GeomPoint size={20} />
  <GeomText size={15} color="#f8fafc" />
  <Labs title="3D billboards" />
</GGPlot>`,
  chart: () => (
    <SitePlot3D
      data={markerData}
      mapping={{ x: "x", y: "y", z: "z", label: "label" }}
    >
      <GeomPoint size={20} />
      <GeomText size={15} color="#f8fafc" />
      <Labs title="3D billboards" />
    </SitePlot3D>
  ),
});

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
