# ADR 001: Typography semantics and font resources

- Status: accepted
- Date: 2026-07-17
- Scope: `GGSpec`, text geoms, plot guides, the Live renderer, emitted source,
  and export

## Context

gggplot currently stores `theme.fontFamily`, forwards a host-provided `fonts`
array to UseGPU's `FontLoader`, and measures guide text with a browser 2D
canvas. Those three paths do not share face resolution or metrics. A requested
face can therefore measure with one font and render with another. `GGSpec` also
has no semantic weight/style fields even though UseGPU resolves faces by family,
weight, and style.

ggplot2 treats family and face as text properties and supports inherited theme
text properties. UseGPU 0.19 resolves a comma-separated family stack together
with numeric/string weight and style, and its glyph engine exposes the actual
font metrics used by SDF text. Resource URLs are host concerns in both cases;
they are not data aesthetics.

## Decision

### Semantic fields

The canonical text style is:

```ts
interface TextStyle {
  family?: string;
  weight?: number | "normal" | "bold";
  style?: "normal" | "italic" | "oblique";
  size?: number;
  color?: string;
  angle?: number;
  lineHeight?: number;
}
```

Theme text defaults use the existing flat names for compatibility (`fontFamily`,
`fontSize`, `textColor`) and add `fontWeight`, `fontStyle`, and `lineHeight`. A
later element hierarchy may wrap the same `TextStyle`; it must not invent a
second face model.

Text geoms accept literal `family`, `fontface`, `size`, `color`, `angle`, and
`lineheight` parameters. At the DSL boundary, `fontface` accepts ggplot-style
`plain`, `bold`, `italic`, and `bold.italic` and normalizes to weight/style.
`family` and `fontface` may also be mapped per row for parity with text geoms,
but they are discrete aesthetics and must split render batches by resolved face.
They do not create legends by default. Guide and title text is theme-only.

Precedence is: mapped row value, literal layer parameter, inherited theme text
default, then the host default face. A field omitted at one level inherits; an
explicit value replaces the inherited value.

### Resource ownership

`GGSpec` contains semantic identifiers only. It never contains URLs, font bytes,
fetch options, or callbacks. The Live host supplies a registry:

```ts
interface FontFaceResource {
  family: string;
  weight: number | string;
  style: "normal" | "italic" | "oblique";
  src?: string;
  lazy?: unknown; // renderer adapter type, not serialized
}

interface FontResources {
  faces: FontFaceResource[];
  defaultFace: { family: string; weight: number; style: string };
  ready(): Promise<void>;
}
```

`GGPlot` may continue to accept the current array as a compatibility shorthand,
but the resource object is the stable host boundary. A URL resolver can be
implemented by the host before constructing this object; it is not part of
`GGSpec`.

### Missing-font behavior

There is one behavior: after resources are ready, a non-empty family/face
request that cannot resolve throws a descriptive error naming the requested
family, weight, and style. Only an omitted family uses `defaultFace`. There is
no silent fallback for an explicit request, because it makes layout and export
nondeterministic.

### Measurement and readiness

Guide layout and SDF rendering must use the same resolved face and glyph
metrics. The renderer exposes a synchronous `measure(text, TextStyle)` only
after `ready()` resolves. Until then, the plot remains in a resource-pending
state and does not compile a final layout. Browser canvas measurement is not an
authoritative fallback; it may be retained only for non-rendering compiler tests
with an explicitly named approximate measurer.

Export waits for `FontResources.ready()`, all requested glyph work, and one
completed render before readback. A missing requested face rejects export with
the same error as interactive rendering.

### Serialization and emitted source

Serialized specs and emitted render trees contain normalized semantic text
styles only. Emitted components accept `fontResources` from their host and do
not embed URLs or font bytes. A self-contained application may import a local
resource registry next to emitted source, but generation of that registry is a
separate packaging concern.

Examples and tests use redistributable fonts (currently Basic under the SIL Open
Font License) or synthetic metric fixtures. No proprietary system font is
required.

## Consequences

- Explicit font requests become reproducible across interactive and exported
  output.
- Layout must move behind font readiness and use glyph-engine metrics.
- Per-row face mapping may create more text batches; this is an intentional,
  bounded cost for parity.
- Existing `fonts={[...]}` callers remain supportable through an adapter, but
  silent fallback for explicit family names is removed.

## Implementation sequence

1. Add and normalize semantic weight/style/family fields for theme and text
   layers, including mapped discrete text face batching.
2. Introduce the host resource object, readiness state, and deterministic
   missing-face validation while retaining the array adapter.
3. Replace browser-canvas production measurement with resolved glyph metrics
   shared by layout and rendering; make export await the same readiness gate.

## Evidence

- [ggplot2's official theme documentation](https://ggplot2.tidyverse.org/reference/theme.html)
  defines text inheritance and text elements for titles, axes, legends, and
  strips.
- [ggplot2's official aesthetic documentation](https://ggplot2.tidyverse.org/reference/aes_linetype_size_shape.html)
  treats text size as a mappable aesthetic; text geoms additionally expose
  family and fontface.
- The locally installed UseGPU 0.19 `FontLoader`, `useFontFamily`,
  `useFontText`, and `useFontHeight` APIs resolve and measure the same
  registered faces used by SDF glyph rendering.
