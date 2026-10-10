// Typed JSX surface for user-authored Use.GPU Live components (vnh.2).
//
// A file opts in with `/** @jsx Jsx.createElement */` on a namespace import of
// this module. TypeScript reads the JSX namespace from `Jsx` when the pragma
// is qualified, so Live components are not checked against React's
// ReactNode return type. Unqualified pragmas still use React's namespace.
import type { LiveElement } from "@use-gpu/live";
import { createElement as liveCreateElement } from "../../../packages/core/src/runtime/usegpu_compat.ts";

export const createElement = liveCreateElement;

// TypeScript only finds the JSX types through a namespace named JSX.
// deno-lint-ignore no-namespace
export namespace JSX {
  /** What a Live component renders to. */
  export type Element = LiveElement;
  /** A component is any props-in, LiveElement-out function. */
  // deno-lint-ignore no-explicit-any
  export type ElementType = (props: any) => LiveElement;
  // No intrinsic elements: Live has no host tags, only components.
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
