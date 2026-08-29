/**
 * Per-gate build output directories (gggplot-8au).
 *
 * Every browser gate used to build into `apps/site/dist` and then serve it, so
 * two gates running at once had the second build clobber the first's output
 * mid-run. The loser then 404s on the bundle its own index.html names, and the
 * symptom -- "Route start leaked or lost chart canvases (surfaces=0)" -- reads
 * exactly like a rendering regression rather than a build race. That cost real
 * debugging time while measuring gggplot-kdg.
 *
 * Each gate now owns `dist-<gate>`, so they are independent. `dist` itself is
 * left to `deno task build`: it is the artifact the Pages workflow uploads and
 * the model-inspection gate measures, and it must not be a scratch directory.
 */

/** Absolute path to a gate's own build directory. */
export function gateOutDir(gate: string): string {
  return new URL(`../dist-${gate}/`, import.meta.url).pathname.replace(
    /\/$/,
    "",
  );
}

/** `vite preview` arguments that serve this gate's directory. */
export function previewArgs(
  gate: string,
  host: string,
  port: number,
  extra: string[] = [],
): string[] {
  return [
    "run",
    "-A",
    "npm:vite",
    "preview",
    "--outDir",
    gateOutDir(gate),
    "--host",
    host,
    "--port",
    String(port),
    "--strictPort",
    ...extra,
  ];
}

/** `vite build` arguments that write to this gate's directory. */
export function buildArgs(gate: string, extra: string[] = []): string[] {
  return [
    "run",
    "-A",
    "npm:vite",
    "build",
    "--outDir",
    gateOutDir(gate),
    ...extra,
  ];
}

/** Build this gate's own copy of the site, failing loudly if it cannot. */
export async function buildGate(gate: string, extra: string[] = []) {
  const built = await new Deno.Command(Deno.execPath(), {
    args: buildArgs(gate, extra),
    cwd: new URL("../", import.meta.url).pathname,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!built.success) {
    throw new Error(`[${gate}] site build failed; the gate cannot run.`);
  }
}
