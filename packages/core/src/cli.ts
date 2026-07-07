#!/usr/bin/env -S deno run -A
// gggplot CLI — `gggplot compile <spec.ts> [out.tsx]` reads a spec module
// (a `spec` or default export of type GGSpec), compiles it, and writes the
// emitted UseGPU Live .tsx source. See emit/mod.ts for the source shape.

import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "./compile/mod.ts";
import { emitSource } from "./emit/mod.ts";
import type { GGSpec } from "./ir/types.ts";

function pascalCase(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("") || "GGChart";
}

async function loadSpec(specPath: string): Promise<GGSpec> {
  const url = pathToFileURL(resolve(specPath)).href;
  const mod = await import(url);
  const spec = mod.spec ?? mod.default;
  if (!spec) {
    throw new Error(`${specPath} must export a GGSpec as 'spec' or as the default export`);
  }
  return spec as GGSpec;
}

function defaultOutPath(specPath: string): string {
  return join(dirname(specPath), `${basename(specPath, extname(specPath))}.tsx`);
}

/** Programmatic entry point — takes argv-style args, writes the .tsx, and returns the path written. */
export async function runCli(args: string[]): Promise<string> {
  const [command, specPath, ...rest] = args;
  if (command !== "compile" || !specPath) {
    throw new Error("Usage: gggplot compile <spec.ts> [out.tsx] [--name=ComponentName]");
  }

  const nameFlag = rest.find((a) => a.startsWith("--name="));
  const outPath = rest.find((a) => !a.startsWith("--")) ?? defaultOutPath(specPath);
  const componentName = nameFlag
    ? nameFlag.slice("--name=".length)
    : pascalCase(basename(outPath, extname(outPath)));

  const spec = await loadSpec(specPath);
  const source = emitSource(compile(spec), componentName);
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
