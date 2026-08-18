// Stable public DSL barrel.
// A DSL expression builds a GGSpec, so its type belongs to this entry: a spec
// builder can then depend on the grammar alone, without the render layer.
export type { GGSpec } from "../ir/types.ts";
export * from "./base.ts";
export * from "./geoms.ts";
export * from "./scales.ts";
export * from "./layout.ts";
export * from "./themes.ts";
