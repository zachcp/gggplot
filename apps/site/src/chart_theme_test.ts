import { assertEquals } from "@std/assert";
import { SitePlot } from "./site_plot.tsx";

const themeOf = (element: unknown) =>
  (element as { args: [{ theme: Record<string, unknown> }] }).args[0].theme;

Deno.test("site chart defaults remain readable while explicit theme fields win", () => {
  const themed = themeOf(SitePlot({ theme: { name: "default" } }));
  assertEquals(themed.fontFamily, "Basic");
  assertEquals(themed.textColor, "#e5e7eb");
  assertEquals(themed.axisColor, "#a8adbd");

  const explicit = themeOf(SitePlot({ theme: { textColor: "#ff0000" } }));
  assertEquals(explicit.textColor, "#ff0000");
});
