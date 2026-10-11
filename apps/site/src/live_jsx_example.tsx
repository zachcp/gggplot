/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// The shipped typed Live JSX surface (gggplot-vnh.2, -05w). Props on gggplot
// components are checked under `deno check`, in JSX and through the plain
// createElement form alike. The wrong-prop lines are expected errors, so the
// check fails if either ever type-checks. Part of `deno task check`.
import type { LiveElement } from "@use-gpu/live";
import { GGPlot } from "@gggplot/core";
import type { GGSpec } from "@gggplot/core";
import * as Jsx from "@gggplot/core/jsx";

export function UserPlot({ spec }: { spec: GGSpec }): LiveElement {
  return <GGPlot spec={spec} />;
}

// @ts-expect-error GGPlot has no `wrongProp` prop; this must not type-check.
export const wrongProp = <GGPlot spec={{} as GGSpec} wrongProp={1} />;

// Without JSX: the same check, for plain .ts callers.
export const viaFactory: LiveElement = Jsx.createElement(GGPlot, {
  spec: {} as GGSpec,
});
// @ts-expect-error GGPlot has no `wrongProp` prop.
export const wrongViaFactory = Jsx.createElement(GGPlot, {
  spec: {} as GGSpec,
  wrongProp: 1,
});
// @ts-expect-error `spec` is required.
export const missingSpec = Jsx.createElement(GGPlot, {});
