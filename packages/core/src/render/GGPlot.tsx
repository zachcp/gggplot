/** @jsxRuntime classic */
/** @jsx createElement */
/** @jsxFrag Fragment */
// Runtime Live backend — interprets a RenderTree into UseGPU Live elements.
//
// This is the other backend to emitSource(): instead of emitting text, it
// resolves component names to real @use-gpu/plot components and builds the Live
// tree in-memory, so a spec can be rendered directly in the browser.

import { createElement, Fragment } from "@use-gpu/live";
import {
  Axis,
  Cartesian,
  Grid,
  Line,
  Plot,
  Point,
  Polar,
  Polygon,
} from "@use-gpu/plot";
import type { ComponentName, RenderNode } from "../compile/rendertree.ts";
import type { GGSpec } from "../ir/types.ts";
import { compile } from "../compile/mod.ts";

// deno-lint-ignore no-explicit-any
const REGISTRY: Partial<Record<ComponentName, any>> = {
  Plot,
  Cartesian,
  Polar,
  Axis,
  Grid,
  Point,
  Line,
  Polygon,
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
}

/**
 * <GGPlot spec={...} /> — compile a spec and render it as a Live subtree.
 * Mount inside a UseGPU <WebGPU><AutoCanvas><Pass> host (see apps/site).
 */
export const GGPlot = ({ spec }: GGPlotProps) => {
  const tree = compile(spec);
  return renderTree(tree);
};
