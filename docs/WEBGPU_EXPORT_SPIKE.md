# Deterministic WebGPU plot export spike

Date: 2026-07-17

## Result

Proceed with a browser-only PNG MVP. The existing scene can render an explicit
`GGSpec` into a dedicated `HTMLCanvasElement` at an exact backing size by using
UseGPU's low-level `Canvas` component with `pixelRatio: 1` instead of
`AutoCanvas`. Workbench's `Screenshot` component already reads the active render
texture, handles BGRA-to-RGBA conversion, writes `ImageData` to a 2D canvas, and
calls `canvas.toBlob(..., "image/png")`.

This is preferable to calling `toBlob()` directly on the WebGPU presentation
canvas: Workbench explicitly reads the render source through a GPU staging
buffer, so it does not depend on presentation-buffer preservation.

## Prototype topology

```text
temporary detached DOM host (width × height CSS px)
└── React root + LiveCanvas (owns a dedicated HTMLCanvasElement)
    └── WebGPU
        └── Canvas(width, height, pixelRatio=1)
            ├── FlatCamera → Pass → GGPlot(explicit spec, fontResources)
            └── Screenshot(once, type="image/png", onBlob)
```

The requested width and height are both layout pixels and output pixels in the
MVP. There is no implicit “last plot,” DPR multiplication, DPI, physical unit,
or scale parameter.

## API decision

The MVP returns one type:

```ts
ggsave(spec, {
  width: number,
  height: number,
  fontResources?: FontResources,
  backgroundColor?: GPUColor,
  signal?: AbortSignal,
}): Promise<Blob>
```

The blob is always `image/png`. A filename/download helper is outside the core
API. `FontResources.readyForExport()` is awaited before mounting; the render
promise resolves only from `Screenshot.onBlob`.

## Lifecycle and cleanup

1. Reject before allocation if WebGPU is unavailable, dimensions are not
   positive integers, or either dimension exceeds the adapter/device
   `maxTextureDimension2D` discovered by the WebGPU host.
2. Await host font resources and lazy glyph readiness.
3. Create a dedicated DOM host and React/Live root; do not reuse or resize the
   interactive chart canvas.
4. Render one frame and read back its render source. GPU readback uses
   `copyTextureToBuffer`, submits the command buffer, and awaits
   `GPUBuffer.mapAsync(GPUMapMode.READ)` before encoding.
5. Resolve the PNG blob, then unmount the Live root, remove the DOM host, and
   release staging/render resources in `finally`.
6. Reject on abort, renderer error, encoding failure, timeout, or device loss;
   cleanup follows the same path.

## Failure behavior

- **No WebGPU / insecure context:** reject with `WebGPU is unavailable`; never
  return a blank PNG.
- **Device loss:** reject the in-flight export. The caller may retry, causing a
  new dedicated device/scene; an export never silently switches devices.
- **Texture limits:** reject dimensions larger than `maxTextureDimension2D`
  before rendering where the adapter is visible. A validation error from context
  configuration is also surfaced rather than clamped.
- **Zero/fractional dimensions:** reject; output size is exact integer pixels.
- **Cross-origin resources:** font URLs are fetched by the host resource
  registry and therefore require normal CORS permission. Canvas encoding is
  origin-clean because WebGPU receives decoded glyph data, but any future image
  geom must reject resources that cannot be fetched/decoded with CORS.
- **Encoding:** PNG is mandatory. `toBlob` returning null is an error.

## CI and headless feasibility

The repository's Chromium visual-smoke runner already initializes WebGPU and
captures rendered routes. The export test should run in that same real-browser
gate, assert `blob.type`, decode the PNG header/IHDR, and compare the exact
requested width and height. Deno unit tests cover validation and cleanup with
injected fakes; they do not claim to exercise a GPU.

WebGPU is a secure-context API, but loopback HTTP is accepted by browsers for
local development. Browser/adapter absence remains a supported rejection path,
not a skipped success.

## Evidence

- The locally installed UseGPU 0.19 `Screenshot` and texture-readback sources
  provide the required GPU-copy, mapping, channel conversion, and Blob encode
  pipeline.
- The [WebGPU specification](https://www.w3.org/TR/webgpu/) defines
  `copyTextureToBuffer` and the device/texture validation model.
- [MDN documents WebGPU canvas support on both HTMLCanvasElement and
  OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/getContext),
  but UseGPU React currently adopts an `HTMLCanvasElement`; a detached DOM
  canvas is therefore the compatible MVP.
- [MDN documents PNG as the required canvas Blob format](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob).

## Follow-up boundaries

- `gggplot-8e0.10` implements and browser-tests the exact-pixel PNG API above.
- `gggplot-8e0.11` separately adds `in`/`cm`/`mm`, DPI, and scale-compatible
  sizing after the pixel contract is stable.
