# Exporting plots

`ggsave()` renders an explicit `GGSpec` on a dedicated WebGPU canvas and returns
a PNG `Blob`. Width and height default to exact pixels; exporting never reads or
resizes the interactive chart.

```ts
import { ggsave } from "@gggplot/core";

const blob = await ggsave(spec, {
  width: 1200,
  height: 800,
  backgroundColor: [1, 1, 1, 1],
  fontResources,
});

const url = URL.createObjectURL(blob);
try {
  image.src = url;
  // Or set an <a download> element's href to url.
} finally {
  URL.revokeObjectURL(url);
}
```

The default background is transparent. `fontResources.readyForExport()` is
awaited before rendering. The promise rejects for invalid or oversized
dimensions, unavailable WebGPU/adapters, resource failures, abort signals,
renderer/device failures, timeouts, and PNG encoding or size mismatches.

Physical sizes use one conversion pipeline:

```text
base pixels   = physical size in inches × dpi
output pixels = round-half-up(base pixels × scale)
layout pixels = output pixels ÷ scale
```

`units` accepts `"px"`, `"in"`, `"cm"`, or `"mm"`; physical units default to 300
DPI and `scale` defaults to 1. Scaling increases output resolution while
preserving typography and layout proportions. Pixel callers that omit these
options retain exactly the original behavior.

```ts
const printBlob = await ggsave(spec, {
  width: 6,
  height: 4,
  units: "in",
  dpi: 300,
  scale: 2,
}); // 3600 × 2400 PNG, laid out as 1800 × 1200 CSS pixels
```

Pass an `AbortSignal` when callers need cancellation:

```ts
const controller = new AbortController();
const pending = ggsave(spec, {
  width: 640,
  height: 480,
  signal: controller.signal,
});
controller.abort();
await pending; // rejects with AbortError
```

Vector output, implicit “last plot” state, and automatic downloads remain
outside this API.
