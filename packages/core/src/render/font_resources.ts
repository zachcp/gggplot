import type { GGSpec } from "../ir/types.ts";
import { columnValues } from "../data/mod.ts";
import { packStrings, type RustTextAPI } from "@use-gpu/glyph";
import type { TextMeasurer } from "../compile/mod.ts";

export interface FontFaceResource {
  family: string;
  weight: string | number;
  style: "normal" | "italic" | "oblique";
  src?: string;
  lazy?: unknown;
}

export interface FontResources {
  faces: FontFaceResource[];
  defaultFace: Pick<FontFaceResource, "family" | "weight" | "style">;
  ready(): Promise<void>;
  /** Resolves after any host-managed lazy glyph work needed for readback. */
  glyphsReady?(): Promise<void>;
  readyForExport(): Promise<void>;
}

export function createFontResources(
  faces: FontFaceResource[],
  defaultFace = faces[0],
): FontResources {
  if (!defaultFace) {
    throw new Error("[gggplot] FontResources requires a default face");
  }
  const ready = () => Promise.resolve();
  return {
    faces,
    defaultFace,
    ready,
    glyphsReady: ready,
    readyForExport: async () => {
      await ready();
    },
  };
}

/** Explicit deterministic fallback for compiler-only environments. */
export const approximateTextMeasurer: TextMeasurer = (text, size) => ({
  width: text.length * size * 0.6,
  height: size,
});

/** Build a measurer from the same RustText instance used by SDF labels. */
export function createGlyphTextMeasurer(rustText: RustTextAPI): TextMeasurer {
  return (text, size, family, weight = 400, style = "normal") => {
    const families = family?.split(/\s*,\s*/).filter(Boolean) ?? [undefined];
    const stack = rustText.resolveFontStack(families.map((name) => ({
      family: name,
      weight: weightNumber(weight),
      style,
    })));
    const { metrics } = rustText.measureSpans(stack, packStrings(text), size);
    const font = rustText.measureFont(stack[0], size);
    return {
      width: metrics[0] ?? 0,
      height: font.lineHeight,
    };
  };
}

function weightNumber(weight: unknown): number {
  if (typeof weight === "number") return weight;
  if (weight === "bold") return 700;
  if (weight === "normal" || weight == null) return 400;
  const parsed = Number(weight);
  return Number.isFinite(parsed) ? parsed : 400;
}

function fontfaceParts(face: unknown): [number, string] | undefined {
  switch (String(face ?? "").toLowerCase().replaceAll("_", ".")) {
    case "plain":
      return [400, "normal"];
    case "bold":
      return [700, "normal"];
    case "italic":
      return [400, "italic"];
    case "bold.italic":
    case "bolditalic":
      return [700, "italic"];
    default:
      return undefined;
  }
}

/** Validate every explicit semantic face request after resources are ready. */
export function validateFontRequests(spec: GGSpec, resources: FontResources) {
  const requests: Array<[string, number, string]> = [];
  const add = (family: unknown, weight: unknown, style: unknown) => {
    if (typeof family !== "string" || family.trim() === "") return;
    requests.push([
      family,
      weightNumber(weight),
      style === "italic" || style === "oblique" ? style : "normal",
    ]);
  };

  add(spec.theme.fontFamily, spec.theme.fontWeight, spec.theme.fontStyle);
  for (const layer of spec.layers) {
    if (layer.geom !== "text" && layer.geom !== "label") continue;
    const mapping = layer.inheritAes === false
      ? (layer.mapping ?? {})
      : { ...spec.mapping, ...layer.mapping };
    const data = layer.data ?? spec.data;
    const mappedFamilies = mapping.family && data[mapping.family]
      ? columnValues(data, mapping.family)
      : [];
    const mappedFaces = mapping.fontface && data[mapping.fontface]
      ? columnValues(data, mapping.fontface)
      : [];
    const count = Math.max(mappedFamilies.length, mappedFaces.length, 1);
    for (let i = 0; i < count; i++) {
      const parts = fontfaceParts(mappedFaces[i] ?? layer.params.fontface);
      add(
        mappedFamilies[i] ?? layer.params.family ?? spec.theme.fontFamily,
        parts?.[0] ?? layer.params.weight ?? spec.theme.fontWeight,
        parts?.[1] ?? layer.params.style ?? spec.theme.fontStyle,
      );
    }
  }

  for (const [familyStack, weight, style] of requests) {
    const families = familyStack.split(",").map((family) => family.trim())
      .filter(Boolean);
    const found = resources.faces.some((face) =>
      families.includes(face.family) && weightNumber(face.weight) === weight &&
      face.style === style
    );
    if (!found) {
      throw new Error(
        `[gggplot] Missing font face: family="${familyStack}", weight=${weight}, style="${style}"`,
      );
    }
  }
}
