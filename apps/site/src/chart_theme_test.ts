import { assertEquals } from "@std/assert";
import type { GGSpec } from "@gggplot/core";
import { withSiteChartTheme } from "./chart_theme.ts";

Deno.test("site chart defaults remain readable while explicit theme fields win", () => {
  const base = { theme: { name: "default" } } as GGSpec;
  const themed = withSiteChartTheme(base);
  assertEquals(themed.theme.fontFamily, "Basic");
  assertEquals(themed.theme.textColor, "#e5e7eb");
  assertEquals(themed.theme.axisColor, "#a8adbd");

  const explicit = withSiteChartTheme({
    ...base,
    theme: { ...base.theme, textColor: "#ff0000" },
  });
  assertEquals(explicit.theme.textColor, "#ff0000");
});
