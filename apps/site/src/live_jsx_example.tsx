/** @jsxRuntime classic */
/** @jsx Jsx.createElement */
// vnh.2 example: a user-authored Live component that renders a gggplot
// component. Its props are type-checked under `deno check`; the wrong-prop
// line is kept as an expected error so the check fails if it ever type-checks.
import type { LiveElement } from "@use-gpu/live";
import { GGPlot } from "@gggplot/core";
import type { GGSpec } from "@gggplot/core";
import * as Jsx from "./live_jsx.ts";

export function UserPlot({ spec }: { spec: GGSpec }): LiveElement {
  return <GGPlot spec={spec} />;
}

// @ts-expect-error GGPlot has no `wrongProp` prop; this must not type-check.
export const wrongProp = <GGPlot spec={{} as GGSpec} wrongProp={1} />;
