export function validateExportDimensions(
  width: number,
  height: number,
  maxTextureDimension2D = Number.POSITIVE_INFINITY,
) {
  if (
    !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 ||
    height <= 0
  ) {
    throw new RangeError(
      `[gggplot] Export dimensions must be positive integer pixels; received ${width}×${height}`,
    );
  }
  if (width > maxTextureDimension2D || height > maxTextureDimension2D) {
    throw new RangeError(
      `[gggplot] Export size ${width}×${height} exceeds WebGPU maxTextureDimension2D=${maxTextureDimension2D}`,
    );
  }
}

/** Decode PNG IHDR dimensions without adding an image-decoder dependency. */
export function pngDimensions(bytes: Uint8Array): [number, number] {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !signature.every((value, i) => bytes[i] === value)) {
    throw new Error("[gggplot] Export encoder returned invalid PNG data");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

export type ExportUnit = "px" | "in" | "cm" | "mm";

export interface ResolvedExportSize {
  width: number;
  height: number;
  /** Canvas DPR: output pixels per layout pixel. */
  pixelRatio: number;
  layoutWidth: number;
  layoutHeight: number;
}

/** Physical units -> DPI pixels -> scale, with one final half-up rounding. */
export function resolveExportSize(options: {
  width: number;
  height: number;
  units?: ExportUnit;
  dpi?: number;
  scale?: number;
}): ResolvedExportSize {
  const units = options.units ?? "px";
  const dpi = options.dpi ?? 300;
  const scale = options.scale ?? 1;
  if (
    !Number.isFinite(options.width) || !Number.isFinite(options.height) ||
    options.width <= 0 || options.height <= 0
  ) {
    throw new RangeError("[gggplot] Export width and height must be positive");
  }
  if (!Number.isFinite(dpi) || dpi <= 0) {
    throw new RangeError("[gggplot] Export DPI must be positive");
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError("[gggplot] Export scale must be positive");
  }
  const inches = units === "in"
    ? 1
    : units === "cm"
    ? 1 / 2.54
    : units === "mm"
    ? 1 / 25.4
    : units === "px"
    ? 1 / dpi
    : (() => {
      throw new RangeError(`[gggplot] Unsupported export units: ${units}`);
    })();
  const outputWidth = Math.floor(options.width * inches * dpi * scale + 0.5);
  const outputHeight = Math.floor(options.height * inches * dpi * scale + 0.5);
  validateExportDimensions(outputWidth, outputHeight);
  return {
    width: outputWidth,
    height: outputHeight,
    pixelRatio: scale,
    layoutWidth: outputWidth / scale,
    layoutHeight: outputHeight / scale,
  };
}
