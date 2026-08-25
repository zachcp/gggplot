# Moving to use.GPU's canonical tensor representation

Status: specification\
Date: 2026-08-24

## The two representations are already the same shape

`FlatTensor` (`packages/core/src/compile/rendertree.ts`) and use.GPU's
`TensorArray` (`@use-gpu/core`) carry the same six fields:

| Field | `FlatTensor` | `TensorArray` |
| --- | --- | --- |
| `array` | `Float32Array` | `TypedArray` |
| `format` | `"f32" \| "vec2" \| "vec4"` | `UniformType` — WGSL spellings |
| `dims` | `1 \| 2 \| 4` | `number` |
| `length` | `number` | `number` |
| `size` | `number[]` | `VectorLike` |
| `version` | `number` | `number?` |
| `ragged` | — | `Ragged?` |

This is not a port. It is one type that drifted into two spellings, and the
divergence is **two string values**: `"vec2"` and `"vec4"` instead of
`"vec2<f32>"` and `"vec4<f32>"`. `"f32"` and `"u32"` are already canonical,
which is why the resident paths (`runtime/resident.ts`,
`runtime/usegpu_compat.ts`) never needed translating and have never been
suspected of this class of bug.

## Why it is worth removing

**Correction (2026-08-24, during implementation): there were FOUR copies, not
three.** The fourth was an inline ternary rather than a named function, which is
exactly why it was missed when this list was written — searching for
`toWgslFormat` does not find it:

- `render/chunked_line.tsx` — `toWgslFormat`
- `render/chunked_face.tsx` — `toWgslFormat`
- `emit/mod.ts` — `toWgslFormat`, embedded as a **string** in the emitted
  module's `TENSOR_SOURCE_SOURCE`
- `render/GGPlot.tsx` — `PointNode`'s `markSource`, an unnamed inline
  `format === "vec4" ? ... : format === "vec2" ? ... : "f32"`

That miscount is itself the argument for the change: the duplication was
already hard to enumerate correctly while reading for it deliberately.

Four copies means there is no chokepoint that guarantees translation. A new
component that consumes a tensor is correct only if its author remembers, and
nothing in the type system says so — `FlatTensor` is structurally acceptable to
anything expecting a `TensorArray`, so a missing translation type-checks
cleanly and fails only at render.

The emitted-source copy is the worst of the three: it ships a hand-written
translator into every generated module, so the duplication escapes the
repository entirely.

## What this does *not* claim

**It is not established that this caused the blank 3D segment and text.** Two
theories were tried and both are falsified by evidence in this repository:

1. *"Plot primitives read our `format` and cannot parse it."* They do not read
   it at all. `Point` and `Label` derive dims from their own schema via
   `getUniformDims(schema.positions.format)`, adjusted only by an explicit
   `formats` prop.
2. *"The schema expects fewer dims than we supply."* Both `POINT_SCHEMA` and
   `LABEL_SCHEMA` default `positions` to `vec4<f32>`, which is exactly what we
   pass.

The 3D point cloud has rendered from an untranslated `vec4` `FlatTensor` since
the unified 3D work, which rules out format translation as a precondition for
drawing. So this migration should be justified as removing duplication and a
latent correctness trap — not sold as a rendering fix. Diagnosing the blank
geoms needs a working WebGPU browser and is tracked separately.

## Target state

`FlatTensor` becomes a `TensorArray`:

```ts
import type { TensorArray } from "@use-gpu/core";
export type FlatTensor = TensorArray;   // or drop the alias entirely
```

with `format` holding `"f32" | "u32" | "vec2<f32>" | "vec4<f32>"`. Every
`toWgslFormat` disappears, including the one embedded in emitted source, and
`useRawTensorSource` receives the tensor unchanged.

**As implemented**, `FlatTensor` stayed a named interface with `format` narrowed
to `"f32" | "vec2<f32>" | "vec4<f32>"` rather than becoming a bare alias of
`TensorArray`. Widening to the full `UniformType` would admit `array<...>` and
matrix shapes that the paired `dims: 1 | 2 | 4` cannot describe, and that
pairing is load-bearing throughout `geom/packing.ts`. Assignability to
`TensorArray` — the property the alias was for — is pinned instead by a
type-level check in `compile/rendertree.ts` that fails to compile if the two
ever drift.

The `formats` prop is the canonical way to tell a plot primitive that data is
not in its schema's default layout. Anywhere we currently reason about dims,
that prop is the supported mechanism and should be used rather than inferred.

## Migration

Ordered so each step is independently verifiable.

| # | Step | Notes |
| --- | --- | --- |
| 1 | Widen `FlatTensor["format"]` to accept both spellings | Additive; nothing breaks |
| 2 | Change the 16 construction sites to emit WGSL spellings | `geom/packing.ts` holds most; `compile/rendertree.ts`, `render/chunked_line.tsx`, `emit/mod.ts`, `runtime/*` hold the rest |
| 3 | Update the ~15 assertions that compare `format` | Tests and site code assert `"vec4"` today |
| 4 | Delete all three `toWgslFormat` copies | Including `TENSOR_SOURCE_SOURCE`'s embedded string |
| 5 | Narrow `format` to `UniformType`, alias `FlatTensor` to `TensorArray` | The step that makes a missed translation unrepresentable |
| 6 | Widen `array` to `TypedArray` | Optional; enables integer tensors |

Steps 1–4 are mechanical. Step 5 is the one with value: after it, there is no
internal spelling left to forget to translate.

## Risks

- **Emitted source changes.** Generated modules currently inline a translator.
  After step 4 they pass `format` straight through, so any emitted-source
  fixture or snapshot must be regenerated. This is the only change visible
  outside the repository.
- **`version` becomes optional** in `TensorArray` while ours is required.
  Residency cache identity keys on it (`tensorStorageCacheKey`), so keep
  populating it; do not let it silently become `undefined`.
- **`size` typing loosens** from `number[]` to `VectorLike`. Confirm the
  `[chunkLen, chunkCount]` form that `sizeToChunkCounts` reads still narrows.
- **No behavioural change is expected.** If rendering changes after step 2,
  that is evidence the format field *was* being read somewhere, which would
  contradict the analysis above and is worth stopping to understand.

## Out of scope

Integer topology arrays (`MarkTopology`'s `Uint32Array` chunks) stay separate.
Folding them into tensors is a larger question about whether topology is data
or metadata, and nothing here depends on the answer.
