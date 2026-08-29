/** @jsxRuntime classic */
/** @jsx createElement */

import { createElement, type LiveElement } from "@use-gpu/live";
import { Mesh } from "@use-gpu/scene";
import { GeometryData } from "@use-gpu/workbench";
import type { GeometryDataProps } from "@use-gpu/workbench/mjs/data/geometry-data.mjs";
import { makeBoxGeometry } from "@use-gpu/workbench/mjs/primitives/geometry/box.mjs";

/** One filled, axis-aligned box in the current 3D Cartesian coordinate space. */
export interface PrismInstance3D {
  center: [number, number, number];
  size: [number, number, number];
  color: string;
}

const UNIT_BOX = makeBoxGeometry();
const UNIT_POSITIONS = UNIT_BOX.attributes.positions;
const UNIT_NORMALS = UNIT_BOX.attributes.normals;

type PrismMesh = Parameters<NonNullable<GeometryDataProps["render"]>>[0];

function colorChannels(color: string): [number, number, number, number] {
  const rgb = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!rgb) throw new TypeError(`Expected #rrggbb prism color, got ${color}`);
  return [
    Number.parseInt(rgb.slice(0, 2), 16) / 255,
    Number.parseInt(rgb.slice(2, 4), 16) / 255,
    Number.parseInt(rgb.slice(4, 6), 16) / 255,
    1,
  ];
}

/**
 * Expand bounded box instances into one indexed-free triangle batch.
 *
 * A tensor slab intentionally caps its display tiles upstream, so this costs
 * a predictable 36 vertices per visible cell and submits one solid mesh. It
 * avoids relying on renderer-specific instance aggregation while retaining a
 * generic input representation for future instanced backends.
 */
/** Flat vertex arrays for one packed prism batch, as GeometryData consumes them. */
interface PrismGeometry {
  count: number;
  attributes: {
    positions: Float32Array;
    normals: Float32Array;
    colors: Float32Array;
  };
  formats: {
    positions: string;
    normals: string;
    colors: string;
  };
}

function prismGeometry(instances: readonly PrismInstance3D[]): PrismGeometry {
  const count = instances.length * UNIT_BOX.count;
  const positions = new Float32Array(count * 4);
  const normals = new Float32Array(count * 4);
  const colors = new Float32Array(count * 4);
  for (const [instanceIndex, instance] of instances.entries()) {
    const [centerX, centerY, centerZ] = instance.center;
    const [width, height, depth] = instance.size;
    const [red, green, blue, alpha] = colorChannels(instance.color);
    const targetStart = instanceIndex * UNIT_BOX.count * 4;
    for (let vertex = 0; vertex < UNIT_BOX.count; vertex++) {
      const offset = targetStart + vertex * 4;
      positions[offset] = centerX + UNIT_POSITIONS[vertex * 4] * width;
      positions[offset + 1] = centerY + UNIT_POSITIONS[vertex * 4 + 1] * height;
      positions[offset + 2] = centerZ + UNIT_POSITIONS[vertex * 4 + 2] * depth;
      positions[offset + 3] = 1;
      normals[offset] = UNIT_NORMALS[vertex * 4];
      normals[offset + 1] = UNIT_NORMALS[vertex * 4 + 1];
      normals[offset + 2] = UNIT_NORMALS[vertex * 4 + 2];
      normals[offset + 3] = 0;
      colors[offset] = red;
      colors[offset + 1] = green;
      colors[offset + 2] = blue;
      colors[offset + 3] = alpha;
    }
  }
  return {
    count,
    attributes: { positions, normals, colors },
    formats: {
      positions: "vec4<f32>",
      normals: "vec4<f32>",
      colors: "vec4<f32>",
    },
  };
}

/** Render filled mini-prisms under the active 3D Cartesian transform. */
export const PrismInstances3D = (
  { instances }: { instances: readonly PrismInstance3D[] },
): LiveElement =>
  createElement(GeometryData, {
    ...prismGeometry(instances),
    render: (mesh: PrismMesh) =>
      createElement(Mesh, {
        mesh,
        side: "both",
        flat: true,
        shaded: false,
        mode: "opaque",
        depthTest: true,
        depthWrite: true,
      }),
  });
