import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { LiveCanvas } from "@use-gpu/react";
import * as Live from "@use-gpu/live";
import { Canvas, WebGPU } from "@use-gpu/webgpu";
import { FlatCamera, Pass, Screenshot } from "@use-gpu/workbench";
import type { GGSpec } from "../ir/types.ts";
import { GGPlot } from "../render/GGPlot.tsx";
import type { FontResources } from "../render/font_resources.ts";
import { resolvePlotDimension } from "../geom/mod.ts";
import {
  type ExportUnit,
  pngDimensions,
  type ResolvedExportSize,
  resolveExportSize,
  validateExportDimensions,
} from "./utils.ts";

export interface GgSaveOptions {
  /** Width in `units`; pixels when units is omitted. */
  width: number;
  /** Height in `units`; pixels when units is omitted. */
  height: number;
  /** Defaults to px, preserving the original exact-pixel contract. */
  units?: ExportUnit;
  /** Physical-unit resolution; defaults to 300. Ignored for px units. */
  dpi?: number;
  /** Multiplies output resolution while preserving layout proportions. */
  scale?: number;
  /** Transparent by default. */
  backgroundColor?: GPUColor;
  fontResources?: FontResources;
  signal?: AbortSignal;
}

interface BoundaryProps extends React.PropsWithChildren {
  onError(error: Error): void;
}

class ExportErrorBoundary extends React.Component<BoundaryProps> {
  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  override render() {
    return this.props.children;
  }
}

function liveExportScene(
  canvas: HTMLCanvasElement,
  renderPlot: () => Live.LiveElement,
  options: GgSaveOptions,
  onBlob: (blob: Blob) => void,
  onError: (error: Error) => void,
  capture: boolean,
  size: ResolvedExportSize,
  ownsPasses: boolean,
) {
  const plot = renderPlot();
  const frame = Live.createElement(
    Live.Fragment,
    {},
    ownsPasses ? plot : Live.createElement(
      FlatCamera,
      {},
      Live.createElement(Pass, {}, plot),
    ),
    capture
      ? Live.createElement(Screenshot, {
        once: true,
        type: "image/png",
        onBlob,
      })
      : null,
  );
  const target = Live.createElement(Canvas, {
    canvas,
    width: size.width,
    height: size.height,
    pixelRatio: size.pixelRatio,
    backgroundColor: options.backgroundColor ?? [0, 0, 0, 0],
    children: frame,
  });
  return Live.createElement(WebGPU, {
    fallback: (error: Error) => {
      queueMicrotask(() => onError(error));
      return null;
    },
    children: target,
  });
}

/** Gap between capture retries; a few attempts, not a per-frame storm. */
const RETRY_INTERVAL_MS = 1_500;

function ExportCanvas(props: {
  renderPlot: () => Live.LiveElement;
  options: GgSaveOptions;
  onBlob(blob: Blob): void;
  onError(error: Error): void;
  size: ResolvedExportSize;
  ownsPasses: boolean;
}) {
  const [capture, setCapture] = React.useState(false);
  const settled = React.useRef(false);
  const onBlob = props.onBlob;
  const handleBlob = React.useCallback((blob: Blob) => {
    settled.current = true;
    onBlob(blob);
  }, [onBlob]);

  React.useEffect(() => {
    // Two frames before the first capture, so the Live tree has drawn
    // something rather than being read back blank.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setCapture(true));
    });

    // Then retry by REMOUNTING the Screenshot (gggplot-kdg).
    //
    // @use-gpu/workbench's Readback sets its internal `read` flag BEFORE
    // awaiting asyncRead, and returns early without calling `then` when that
    // read yields null. With once:true the following `if (once && read) return
    // null` disarms it permanently, so one failed readback means onBlob never
    // fires and the export hangs to its 30s timeout.
    //
    // once:false was tried and REJECTED: dispatching a full-canvas copy every
    // frame made the flake markedly worse (5 of 7 runs, versus roughly 1 in 4),
    // adding click and evaluation timeouts of its own -- a readback storm
    // pressures the device rather than rescuing it. Unmounting and remounting
    // gives a fresh Readback, so each retry costs one dispatch.
    const retry = setInterval(() => {
      if (settled.current) return;
      setCapture(false);
      requestAnimationFrame(() => {
        if (!settled.current) setCapture(true);
      });
    }, RETRY_INTERVAL_MS);

    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      clearInterval(retry);
    };
  }, []);
  return React.createElement(LiveCanvas, {
    style: {
      display: "block",
      width: `${props.size.layoutWidth}px`,
      height: `${props.size.layoutHeight}px`,
    },
    render: (canvas) =>
      liveExportScene(
        canvas,
        props.renderPlot,
        props.options,
        handleBlob,
        props.onError,
        capture,
        props.size,
        props.ownsPasses,
      ),
  });
}

/** Render a Live plot subtree on a dedicated WebGPU target and return a PNG. */
export async function saveLivePng(
  renderPlot: () => Live.LiveElement,
  options: GgSaveOptions,
  scene: { ownsPasses?: boolean } = {},
): Promise<Blob> {
  const size = resolveExportSize(options);
  if (typeof document === "undefined" || typeof navigator === "undefined") {
    throw new Error("[gggplot] PNG export requires a browser DOM and WebGPU");
  }
  if (!navigator.gpu) {
    throw new Error("[gggplot] WebGPU is unavailable in this browser/context");
  }
  if (options.signal?.aborted) {
    throw new DOMException("Plot export was aborted", "AbortError");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("[gggplot] No WebGPU adapter is available");
  validateExportDimensions(
    size.width,
    size.height,
    adapter.limits.maxTextureDimension2D,
  );
  await options.fontResources?.readyForExport();

  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${size.layoutWidth}px`,
    height: `${size.layoutHeight}px`,
    pointerEvents: "none",
  });
  document.body.append(host);
  let root: Root | undefined;
  let abort: (() => void) | undefined;

  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(
        () =>
          finish(
            new Error(
              "[gggplot] PNG export timed out while waiting for WebGPU readback; the device may have been lost",
            ),
          ),
        30_000,
      );
      const finish = (result: Blob | Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        result instanceof Error ? reject(result) : resolve(result);
      };
      abort = () =>
        finish(new DOMException("Plot export was aborted", "AbortError"));
      options.signal?.addEventListener("abort", abort, { once: true });
      root = createRoot(host);
      root.render(
        React.createElement(
          ExportErrorBoundary,
          { onError: finish },
          React.createElement(ExportCanvas, {
            renderPlot,
            options,
            onBlob: finish,
            onError: finish,
            size,
            ownsPasses: scene.ownsPasses ?? false,
          }),
        ),
      );
    });
    if (blob.type !== "image/png") {
      throw new Error(`[gggplot] Expected image/png, received ${blob.type}`);
    }
    const dimensions = pngDimensions(new Uint8Array(await blob.arrayBuffer()));
    if (dimensions[0] !== size.width || dimensions[1] !== size.height) {
      throw new Error(
        `[gggplot] Export size mismatch: requested ${size.width}×${size.height}, encoded ${
          dimensions[0]
        }×${dimensions[1]}`,
      );
    }
    return blob;
  } finally {
    if (abort) options.signal?.removeEventListener("abort", abort);
    root?.unmount();
    host.remove();
  }
}

/** Render an explicit gggplot spec on a dedicated WebGPU target. */
export function ggsave(spec: GGSpec, options: GgSaveOptions): Promise<Blob> {
  return saveLivePng(
    () =>
      Live.createElement(GGPlot, {
        spec,
        interactive: false,
        fontResources: options.fontResources,
      }),
    options,
    { ownsPasses: resolvePlotDimension(spec).dimensions === 3 },
  );
}
