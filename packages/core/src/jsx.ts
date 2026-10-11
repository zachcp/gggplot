// Typed Live JSX for gggplot and Use.GPU components (gggplot-vnh.2, -05w).
//
// Use.GPU's Live renders with the classic JSX runtime, but TypeScript resolves
// an unqualified `@jsx createElement` against React's JSX namespace, where a
// component returning a LiveElement is not a valid element (TS2786). A file
// that opts in with a QUALIFIED pragma reads the JSX namespace from this module
// instead, so Live components type-check and wrong props fail:
//
//   /** @jsxRuntime classic */
//   /** @jsx Jsx.createElement */
//   /** @jsxFrag Jsx.Fragment */
//   import * as Jsx from "@gggplot/core/jsx";
//
// Without JSX, call `createElement` directly: it checks props the same way.
import type { LiveElement } from "@use-gpu/live";
import {
  createElement as liveCreateElement,
  Fragment as liveFragment,
} from "./runtime/usegpu_compat.ts";

/** A Live component: props in, LiveElement out. */
export type LiveComponent<P> = (props: P) => LiveElement;

/** Props as passed at a call site: `children` may also come positionally. */
export type ElementProps<P> =
  & Omit<P, "children">
  & Partial<Pick<P, Extract<keyof P, "children">>>
  & { key?: string | number };

/** A Live builtin such as Fragment. Live tags these with `isLiveBuiltin`. */
export interface LiveBuiltin {
  readonly isLiveBuiltin: true;
}

/** Live's fragment builtin, for `@jsxFrag Jsx.Fragment`. */
export const Fragment = liveFragment as LiveBuiltin;

/**
 * Builds a Live element, with `props` checked against the component.
 * This is the JSX factory and the non-JSX form of the same thing.
 */
export function createElement<P>(
  type: LiveComponent<P>,
  props?: ElementProps<P> | null,
  ...children: unknown[]
): LiveElement;
/**
 * Fragments and other Live builtins take untyped props. Only builtins: a
 * catch-all here would quietly accept a component whose props failed above.
 */
export function createElement(
  type: LiveBuiltin,
  props?: Record<string, unknown> | null,
  ...children: unknown[]
): LiveElement;
export function createElement(
  type: unknown,
  props?: Record<string, unknown> | null,
  ...children: unknown[]
): LiveElement {
  return liveCreateElement(type, props, ...children);
}

// TypeScript only finds JSX types through a namespace named JSX.
// deno-lint-ignore no-namespace
export namespace JSX {
  /** What a Live component renders to. */
  export type Element = LiveElement;
  /** A component is any props-in, LiveElement-out function. */
  // deno-lint-ignore no-explicit-any
  export type ElementType = (props: any) => LiveElement;
  // Live has no host tags, only components.
  // deno-lint-ignore no-empty-interface
  export interface IntrinsicElements {}
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  /** Live reconciles keyed siblings by key, like React. */
  export interface IntrinsicAttributes {
    key?: string | number;
  }
}
