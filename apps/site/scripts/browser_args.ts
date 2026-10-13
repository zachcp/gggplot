/**
 * Chromium launch flags shared by the browser gates.
 *
 * Local runs get whatever WebGPU adapter Chromium picks. CI runners have no
 * GPU, so the CI job sets GGGPLOT_CHROMIUM_ARGS to run WebGPU on SwiftShader,
 * and which flags it uses matters (gggplot-w760):
 *
 *   --enable-features=Vulkan --use-vulkan=swiftshader
 *   --use-angle=swiftshader --enable-unsafe-swiftshader
 *
 * A WebGPU canvas presents through a shared image that the compositor reads.
 * On Linux that image needs Vulkan interop. With GL alone (the old
 * --use-angle=swiftshader --use-gl=swiftshader), Dawn still hands out a
 * SwiftShader adapter, so compute and offscreen passes work. The first
 * canvas frame then fails ("Could not find SharedImageBackingFactory ...
 * WebgpuSwapChainTexture"), taking the WebGPU instance with it. Every later
 * call reports "A valid external Instance reference no longer exists" or
 * "createBuffer failed, size (40) is too large". gggplot-5xq read that as
 * SwiftShader being unable to run use.GPU. It can; it was the flags.
 * --use-gl=swiftshader is also no longer a valid GL implementation, and
 * crashes the GPU process three times on startup.
 *
 * scripts/webgpu_probe.ts checks exactly this without gggplot, and CI runs it
 * before the gates.
 */
export function browserArgs(): string[] {
  const base = ["--enable-unsafe-webgpu", "--enable-webgpu-developer-features"];
  const extra = (Deno.env.get("GGGPLOT_CHROMIUM_ARGS") ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return [...base, ...extra];
}
