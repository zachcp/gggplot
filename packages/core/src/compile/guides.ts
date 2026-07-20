// Guide rendering barrel: shared label/text primitives, legend keys, and axis
// tick/title overlays. Split into guide_text.ts (shared), legends.ts, and
// axes.ts; re-exported here so `compile/guides.ts` remains the single import
// surface (including the TextMeasurer type consumed by the geom package).
export * from "./guide_text.ts";
export * from "./legends.ts";
export * from "./axes.ts";
