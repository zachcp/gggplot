#!/usr/bin/env -S deno run -A
// gggplot CLI — `gggplot print <chart.tsx> [out.tsx] [--name=Component]`
// loads a module that builds a component tree (a `chart` or default export:
// an element, or a function returning one) and writes it out as the JSX a
// user would write (emit/jsx.ts). Data and helpers are imported from the
// input module by reference, never inlined.

import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { LiveElement } from "@use-gpu/live";
import { printModule } from "./emit/jsx.ts";

function pascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("") || "GGChart";
}

function defaultOutPath(chartPath: string): string {
  return join(
    dirname(chartPath),
    `${basename(chartPath, extname(chartPath))}.printed.tsx`,
  );
}

/** The specifier `outPath`'s module imports `chartPath` by. */
function specifierFor(outPath: string, chartPath: string): string {
  const path = relative(dirname(resolve(outPath)), resolve(chartPath))
    .split("\\").join("/");
  return path.startsWith(".") ? path : `./${path}`;
}

/** Programmatic entry point: takes argv-style args, writes the .tsx, returns its path. */
export async function runCli(args: string[]): Promise<string> {
  const [command, chartPath, ...rest] = args;
  if (command !== "print" || !chartPath) {
    throw new Error(
      "Usage: gggplot print <chart.tsx> [out.tsx] [--name=ComponentName]",
    );
  }
  const nameFlag = rest.find((a) => a.startsWith("--name="));
  const outPath = rest.find((a) => !a.startsWith("--")) ??
    defaultOutPath(chartPath);
  const name = nameFlag
    ? nameFlag.slice("--name=".length)
    : pascalCase(basename(outPath, extname(outPath)).replace(/\.printed$/, ""));

  const mod = await import(pathToFileURL(resolve(chartPath)).href) as Record<
    string,
    unknown
  >;
  const chart = mod.chart ?? mod.default;
  if (!chart) {
    throw new Error(
      `${chartPath} must export a component tree as 'chart' or as the default export`,
    );
  }
  const element =
    (typeof chart === "function" ? chart() : chart) as LiveElement;
  // Everything else the module exports is nameable: capitalized functions
  // are components, the rest are values passed by reference.
  const refs = new Map<unknown, string>();
  const names = new Map<unknown, string>();
  for (const [key, value] of Object.entries(mod)) {
    if (value === chart || key === "default") continue;
    if (typeof value === "function" && /^[A-Z]/.test(key)) {
      names.set(value, key);
    } else if (
      value !== null && typeof value !== "string" && typeof value !== "number"
    ) {
      refs.set(value, key);
    }
  }
  const source = printModule(element, {
    name,
    from: specifierFor(outPath, chartPath),
    refs,
    names,
  });
  await Deno.writeTextFile(outPath, source);
  return outPath;
}

if (import.meta.main) {
  try {
    const outPath = await runCli(Deno.args);
    console.log(`Wrote ${outPath}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    Deno.exit(1);
  }
}
