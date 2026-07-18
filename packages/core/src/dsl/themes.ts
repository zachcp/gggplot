import type { PlotLabels, Theme } from "../ir/types.ts";
import type { SpecPart } from "./base.ts";

export const labels = (value: PlotLabels = {}): SpecPart => ({
  tag: "labels",
  value,
});

export const themeMinimal = (): SpecPart => ({
  tag: "theme",
  value: { name: "minimal" },
});
/** No panel background, no grid lines — just axes (ggplot2's theme_classic). */
export const themeClassic = (): SpecPart => ({
  tag: "theme",
  value: { name: "classic", grid: false },
});
/** Grey panel background with white grid lines (ggplot2's default theme_grey). */
export const themeGrey = (): SpecPart => ({
  tag: "theme",
  value: { name: "grey", background: "#ebebeb", gridColor: "#ffffff" },
});
export const themeBw = (): SpecPart => ({
  tag: "theme",
  value: {
    name: "bw",
    background: "#ffffff",
    gridColor: "#d9d9d9",
    axisColor: "#000000",
  },
});
export const themeLinedraw = (): SpecPart => ({
  tag: "theme",
  value: {
    name: "linedraw",
    background: "#ffffff",
    gridColor: "#d0d0d0",
    gridWidth: 0.5,
    axisColor: "#000000",
    axisWidth: 0.5,
  },
});
export const themeLight = (): SpecPart => ({
  tag: "theme",
  value: {
    name: "light",
    background: "#ffffff",
    gridColor: "#dedede",
    axisColor: "#8a8a8a",
  },
});
export const themeDark = (): SpecPart => ({
  tag: "theme",
  value: {
    name: "dark",
    background: "#303030",
    gridColor: "#666666",
    axisColor: "#ffffff",
    textColor: "#ffffff",
  },
});
export const themeVoid = (): SpecPart => ({
  tag: "theme",
  value: { name: "void", background: null, grid: false, axes: false },
});
export const themeTest = (): SpecPart => ({
  tag: "theme",
  value: {
    name: "test",
    background: "#ffffff",
    gridColor: "#c8c8c8",
    axisColor: "#000000",
    fontSize: 11,
  },
});
/** Arbitrary theme overrides, mergeable on top of themeMinimal()/themeClassic()/themeGrey() — mirrors ggplot2's theme(...). */
export const theme = (overrides: Partial<Theme> = {}): SpecPart => ({
  tag: "theme",
  value: overrides,
});
