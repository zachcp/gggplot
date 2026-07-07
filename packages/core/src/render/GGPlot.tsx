/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
// Runtime Live backend — interprets a RenderTree into UseGPU Live elements.
//
// This is the other backend to emitSource(): instead of emitting text, it
// resolves component names to real @use-gpu/plot components and builds the Live
// tree in-memory, so a spec can be rendered directly in the browser.

import { createElement, Fragment, provide, useContext } from "@use-gpu/live";
import {
  Axis,
  Cartesian,
  Embedded,
  Grid,
  Label,
  Line,
  Plot,
  Point,
  Polar,
  Polygon,
} from "@use-gpu/plot";
import { FontLoader, LayoutContext } from "@use-gpu/workbench";
import type { ComponentName, RenderNode } from "../compile/rendertree.ts";
import type { GGSpec } from "../ir/types.ts";
import { compile } from "../compile/mod.ts";

export interface FacetGridProps {
  nrow: number;
  ncol: number;
  gap?: number;
  // Live's createElement collapses a single child to a bare value instead of
  // a 1-element array (see jsx.mjs's toChildren), so this may arrive as
  // either shape.
  children?: unknown[] | unknown;
}

/**
 * Not a real @use-gpu/plot export (see rendertree.ts) — divides the ambient
 * ancestor LayoutContext pixel rect ([left, top, right, bottom]) into an
 * nrow x ncol grid with `gap` px between cells, and provides each cell as the
 * LayoutContext for one child in row-major order. Each child is expected to
 * be an <Embedded> (with no explicit `layout` prop of its own), which reads
 * this per-cell LayoutContext to build its own normalized coordinate space —
 * giving facet_wrap/facet_grid their multi-panel layout without Embedded
 * itself needing to know about faceting.
 */
export const FacetGrid = (props: FacetGridProps) => {
  const { nrow, ncol, gap = 0, children } = props;
  const kids = Array.isArray(children) ? children : children != null ? [children] : [];
  const [left, top, right, bottom] = useContext(LayoutContext) as [number, number, number, number];
  const cellW = (right - left) / ncol;
  const cellH = (bottom - top) / nrow;

  return createElement(
    Fragment,
    {},
    ...kids.map((child, i) => {
      const row = Math.floor(i / ncol);
      const col = i % ncol;
      const cell: [number, number, number, number] = [
        left + col * cellW + gap / 2,
        top + row * cellH + gap / 2,
        left + (col + 1) * cellW - gap / 2,
        top + (row + 1) * cellH - gap / 2,
      ];
      return provide(LayoutContext, cell, child as never);
    }),
  );
};

// deno-lint-ignore no-explicit-any
const REGISTRY: Partial<Record<ComponentName, any>> = {
  Plot,
  Embedded,
  Cartesian,
  Polar,
  Axis,
  Grid,
  Point,
  Line,
  Polygon,
  Label,
  FacetGrid,
};

/** Recursively turn a RenderNode into a Live element. */
export function renderTree(n: RenderNode): unknown {
  const Component = REGISTRY[n.component];
  if (!Component) {
    console.warn(`[gggplot] no Live component for "${n.component}"`);
    return null;
  }
  const children = n.children.map(renderTree);
  return createElement(Component, n.props, ...children);
}

export interface GGPlotProps {
  spec: GGSpec;
  fonts?: { family: string; weight: string | number; style: string; src?: string }[];
}

/**
 * <GGPlot spec={...} /> — compile a spec and render it as a Live subtree.
 * Mount inside a UseGPU <WebGPU><AutoCanvas><FlatCamera><Pass> host (see
 * apps/site): FlatCamera supplies the pixel-space layout that compile()'s
 * root <Embedded normalize> bridges into Cartesian's normalized coordinates.
 * Wrapped in a host-configurable FontLoader: @use-gpu/plot's <Plot>
 * (established internally by Embedded) always wraps its children in an
 * SDFFontProvider, which throws if no FontContext ancestor exists. Text
 * renders visibly when the host supplies real font sources.
 */
export const GGPlot = ({ spec, fonts }: GGPlotProps) => {
  const tree = compile(spec);
  // deno-lint-ignore no-explicit-any
  return createElement(FontLoader, { fonts }, renderTree(tree) as any);
};
