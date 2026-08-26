/**
 * Chromium launch flags shared by the browser gates.
 *
 * These gates need a real WebGPU device. Measured on 2026-08-25 (gggplot-5xq):
 * relaunching with SwiftShader — the software path a GPU-less CI runner would
 * fall back to — failed 17 of 17 routes with "[Invalid Texture] is invalid due
 * to a previous error", "A valid external Instance reference no longer exists"
 * and atlas allocation failures. SwiftShader does not carry use.GPU's pipeline.
 *
 * So the CI job that runs these is non-blocking, and sets GGGPLOT_CHROMIUM_ARGS
 * to the software-rendering flags. That is deliberately a hook rather than a
 * hardcoded fallback: it keeps local runs on the real GPU, and it means the day
 * SwiftShader or use.GPU closes that gap the job starts passing on its own
 * instead of staying red forever because nothing ever re-tested it.
 */
export function browserArgs(): string[] {
  const base = ["--enable-unsafe-webgpu", "--enable-webgpu-developer-features"];
  const extra = (Deno.env.get("GGGPLOT_CHROMIUM_ARGS") ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return [...base, ...extra];
}
