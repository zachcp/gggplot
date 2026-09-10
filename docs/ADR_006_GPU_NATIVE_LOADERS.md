# ADR 006: GPU-native loaders returning Use.GPU source types

Status: accepted\
Decision bead: `gggplot-vs7.3`\
Epic: `gggplot-vs7` (pure Use.GPU implementation)\
Implemented by: `gggplot-vs7.9` (SafeTensors), `gggplot-vs7.10` (column loader)

This ADR specifies a loader tier that returns Use.GPU-native source handles
instead of CPU byte buffers and boxed `number[]`, so a model tensor reaches the
GPU without a decode pass. It is the loader half of `gggplot-vs7`; the compute
half (`<Kernel>` over dual-surface WGSL) is a prerequisite, because the dtype
adapters this ADR specifies _are_ kernels.

It is not a redesign. `TensorSource` already declares "it returns bytes, never a
GPU handle", `ResidencyRecord.resource` was already reserved as "runtime-only
identity for a useGPU source/buffer/texture", and
`DEFAULT_CONTENT_BUDGET.maxReadbackBytes` was already `0`. This fills in a
socket the IR deliberately left open.

## The chain being replaced

Drawing one f32 tensor heatmap in the model inspector costs four payload
materializations, three of which exist only to undo the previous one.

| # | Where                                        | What is allocated                          |
| - | -------------------------------------------- | ------------------------------------------ |
| 1 | `packages/model-inspect/src/residency.ts:58` | `bytes.slice(start, end)` — the byte range |
| 2 | `packages/model-inspect/src/products.ts:752` | `number[]`, one boxed double per element   |
| 3 | `apps/site/src/model_tensor_views.ts:54`     | one `{row, column, value}` object per cell |
| 4 | `packages/core/src/data/mod.ts:323`          | `Float32Array` via `typedArrayForColumn`   |
| ⇒ | `packages/core/src/runtime/live.tsx:42`      | `<RawData>` uploads it                     |

Bytes → slice → boxed numbers → cell objects → typed array → GPU, to draw a
picture of bytes that were already in exactly the layout the GPU wanted. At
`DEFAULT_CONTENT_BUDGET.maxOverviewCells` (512×512) step 2 alone is 262,144
boxed doubles per view change.

## Decision 1 — the contract lives in `model-inspect`; the adapter lives in `core`

**Decided:** `@gggplot/model-inspect` declares the types and owns the raw-WebGPU
implementation. `@gggplot/core` owns everything that touches `@use-gpu/*` or the
Live tree.

**Corrected during implementation (`gggplot-vs7.9`).** This decision first read
"core owns every implementation that touches a device or a shader", which is
wrong and the repo already says so: `@gggplot/reductions` is the same
standalone/headless package shape, has the same zero npm dependencies, and owns
`createBuffer`, `writeBuffer`, dispatch, readback and raw WGSL throughout
`packages/reductions/src/gpu/`. Raw WebGPU is a platform API, and drawing the
boundary at it would have made `model-inspect` the only package forbidden to use
one. The boundary that actually matters — the one that keeps a package headless
and npm-free — is `@use-gpu/*`. So the loader's upload path and its adapter pass
BODIES live in `model-inspect`, and their `@link` forms live in core, which is
exactly the dual surface `reductions` and `core/src/render/*_kernels.ts` already
form.

`@gggplot/model-inspect` has the same standalone/headless posture as
`@gggplot/reductions`, and its `deno.json` proves it: its only imports are
`@std/assert` and `@gggplot/core/plan`. Nothing in the package names an npm
dependency. The proposed `import type { StorageSource } from "@use-gpu/core"`
would end that, for a type.

So `TensorStorageSource` (`residency.ts:75`) mirrors Use.GPU's `StorageSource`
field-for-field instead of importing it. This is not a new pattern: it is
exactly the call `packages/core/src/runtime/types.ts::GPUStorageSource` already
makes on the mark side, and it is why `@gggplot/reductions` can hand real
`GPUBuffer`s to a mounted tree without ever naming `@use-gpu`. `GPUBuffer` and
`GPUDevice` are platform types from the `dom` lib the package already compiles
against, not dependencies.

The contract half that must live in `model-inspect` is small and fixed:

- `TensorStorageSource` — the handle (`residency.ts:75`)
- `GPUTensorSource extends TensorSource` — the loader (`residency.ts:103`)
- `TENSOR_UPLOAD_PLANS` — the dtype policy (`residency.ts:175`)
- `ResidencyRecord.resource`, narrowed (`residency.ts:341`)
- `TensorContentProduct.source` (`products.ts:470`)

The implementation half splits along the `@use-gpu` line:

- `model-inspect` — `ByteArrayGPUTensorSource`, the upload, and the adapter pass
  bodies with the hand-numbered preamble its standalone executor uses.
- `core` — the `@link` preamble over those same bodies, and the `useSource`
  binding that puts the result in front of a mark.

**Rejected:** an adapter in core over the byte-returning `TensorSource`, with no
type change in `model-inspect` at all. It reads cleaner on the package graph but
leaves `TensorContentProduct` unable to describe its own GPU form, which pushes
every consumer into a parallel side-channel keyed by cache key. The product is
the right place to say where its payload is.

## Decision 2 — loading stays out of the Live tree

**Decided:** a loader must not require a mounted tree. Fetching and parsing
happen wherever the host wants (the site does this in React today,
`apps/site/src/OnnxRuntimeCanvas.tsx:94`); the adapter is handed a device and a
validated range.

`GPUTensorSource` therefore carries `readonly device: GPUDevice` explicitly
rather than reaching for `useDeviceContext()`. The host that has a device
constructs the source; `readRangeSource` is an ordinary async method, callable
from an effect, a worker, or a test.

**Rejected:** workbench's `<Fetch>` inside the Live tree. It would make model
loading depend on a mounted canvas, which breaks the headless posture Decision 1
just protected, and it puts network latency inside the render tree's resume
path. `<Fetch>` remains available to a host that wants it; nothing in this tier
requires it.

## Decision 3 — no new budget field; the device limit is the new ceiling

**Decided:** the GPU path reuses `ContentBudget.maxResidentBytes`. What it adds
is `residentUploadCeiling(device, maxResidentBytes)` (`residency.ts:312`), which
is `min(maxResidentBytes, device.limits.maxStorageBufferBindingSize)`.

A second budget knob would let the CPU and GPU paths disagree about what
"resident" means, and the session ceiling is not the thing that was missing. The
thing that was missing is the _device_ ceiling, which is not a policy choice at
all: `maxStorageBufferBindingSize` defaults to 128 MiB and `maxBufferSize` to
256 MiB, and a range past either fails at bind or allocation time with an error
that does not name the tensor. Checking it in the loader turns that into a
`summary` representation and a diagnostic, which is the behavior the budget
already has for oversized ranges.

Alignment is handled by `alignedUploadBytes` (`residency.ts:294`):
`createBuffer` sizes and `writeBuffer` sizes are both required to be multiples
of four, and a tensor range need not be — an `i8` or `bool` tensor with a row
count that is not a multiple of four ends on an odd byte. Rounding up is the
whole fix; the pad sits past the last element and no accessor reads it, because
`length` (elements) and not the buffer size bounds every dispatch.

## Decision 4 — storage sources only; no textures in this tier

**Decided:** every representation this tier serves returns a
`TensorStorageSource`. `ResidencyRecord.resource` is narrowed to
`TensorStorageSource | undefined`, not to
`StorageSource | TextureSource |
undefined`.

Three reasons, in order of weight:

1. **Nothing on the path samples.** `exact`, `tile` and `downsample` all render
   through vertex expansion into a raster/tile mark, the same way the resident
   histogram's bars do (`resident_bar.tsx:84` binds a storage buffer with
   `useSource`). A storage source lands with zero new mark plumbing; a texture
   needs a sampler path that does not exist yet.
2. **A texture would not buy filtering anyway.** The one representation with a
   real texture argument is `downsample`, whose overview is a mip chain. But
   `r32float` is not filterable in core WebGPU (that is the optional
   `float32-filterable` feature), and the formats that _are_ filterable at 16
   bits do not support `STORAGE_BINDING` in core — so the mip chain would have
   to be produced by a render pass rather than by the adapter kernels this ADR
   already needs. That is a second, different mechanism for one representation.
3. **The narrowing is what gives eviction teeth.** `transitionResidency`'s
   evicted branch cleared an `unknown`, which drops a reference and leaks the
   allocation behind it. With a known handle type, `evictResidency`
   (`residency.ts:449`) can call `destroy()`.

**Trigger to reopen:** a measured overview that is _sampling_-bound rather than
fill-bound — i.e. a downsample representation where generating the reduced grid
in a kernel costs more than a mip chain would. Until that measurement exists,
this stays one mechanism.

## Decision 5 — the dtype table is data, and the adapters are `<Kernel>`s

WGSL storage buffers speak `f32`/`u32`/`i32`. `ModelDType` covers
f16/bf16/f64/i64/u64/i8/i16/u8/u16/bool. The conversion that used to be the CPU
decode loop becomes a compute pass, written once on the linked-bundle machinery
rather than hand-rolled a second time — which is why this bead depends on the
compute track.

`TENSOR_UPLOAD_PLANS` (`residency.ts:175`) encodes the policy as data rather
than as a switch, so a headless test can read it:

| dtype                      | path          | format      | adapter      | exact? |
| -------------------------- | ------------- | ----------- | ------------ | ------ |
| `f32`, `u32`, `i32`        | `direct`      | same        | none         | yes    |
| `f16`                      | `widen`       | `f32`       | `widen_f16`  | yes    |
| `bf16`                     | `widen`       | `f32`       | `widen_bf16` | yes    |
| `i8`, `i16`                | `unpack`      | `i32`       | `unpack_i*`  | yes    |
| `u8`, `u16`, `bool`        | `unpack`      | `u32`       | `unpack_u*`  | yes    |
| `f64`                      | `narrow`      | `f32`       | `narrow_f64` | no     |
| `i64` / `u64`              | `narrow`      | `i32`/`u32` | `narrow_*`   | no     |
| `string`, anything unknown | `unsupported` | —           | —            | —      |

Notes that are decisions rather than description:

- **`bf16` widens by shifting left 16 into the f32 bit pattern.** bf16 is a
  truncated f32, so this is exact and needs no rounding mode.
- **`f16` widens even where `shader-f16` is available.** Binding f16 natively
  would fork `format` for every consumer, and the mark path
  (`core/src/runtime/resident.ts::requireStorage`) knows only `f32` and `u32`.
  The feature saves half the buffer bytes and costs a format fork across the
  whole source contract. Revisit only if a measured f16 tensor is buffer-bound.
- **The 64-bit rows are lossy, with the same documented loss the CPU path
  already has.** `decodeValue` narrows i64/u64 through `BigInt` to a JS number,
  exact to 2^53. Moving the narrowing into a kernel changes where the loss
  happens, not whether it does, so the existing diagnostics carry over verbatim.
- **An unknown dtype answers `unsupported` rather than throwing.** `ModelDType`
  admits arbitrary strings — a quantized format the IR has not been taught yet —
  and the correct behavior for one is the CPU `values` path we already have, not
  a crash.

## Decision 6 — `values` is retained, not replaced

`TensorContentProduct` gains `source` (`products.ts:470`) as a _sibling_ to
`values`, not a replacement. Same dual-surface discipline as the WGSL work: the
CPU form stays as the parity reference, the export path, and the fallback for
every dtype the table calls `unsupported`; the GPU form is what renders.

A product carrying `source` is runtime-only and no longer JSON-serializable —
the rule `RuntimeGpuTensorBinding` already states ("never serialized into
`ModelDocument`"). Anything that serializes a product goes through `values`.

## Cache identity — no new invalidation logic

`tensorRangeCacheKey` already produces a stable key for a logical range _before_
it has a resource. The GPU loader keys its source on that same string, so the
existing residency state machine (metadata → summary → range → product →
evicted) governs GPU buffer lifetime unchanged. The only change is the narrowed
`resource` type and the eviction hook it enables.

## Worked trace: f32, four copies to one

Executable as `packages/model-inspect/tests/gpu_loader_test.ts`.

**Today (4).** `buildTensorContentProduct` on a 4×4 f32 tensor returns
`values.length === 16` and `source === undefined`. Copies 1 and 2 happen inside
`model-inspect` (the `slice`, then the boxed decode); the site adds copy 3 (cell
objects) and core adds copy 4 (`typedArrayForColumn`'s `Float32Array`) before
`<RawData>` uploads.

**With the tier (1).** `F32TensorGPUSource.readRangeSource` — the reference
implementation `gggplot-vs7.9` builds against a real device — calls
`device.queue.writeBuffer(buffer, 0, bytes.buffer, byteOffset, byteLength)`
once. The probe device records exactly one write of exactly `byteLength` bytes.
The returned `TensorStorageSource` reports `format: "f32"`, `length: 16`,
`size: [4, 4]`; nothing is read back, which is what `maxReadbackBytes === 0`
already asked for. Copies 2, 3 and 4 do not exist on this path: the product
carries a handle instead of an array, so there is no boxed array to build cells
from and no typed array to lower back to.

The residency test then shows the key is identical before and after upload, and
that `evictResidency` destroys the buffer the loader created while leaving a
borrowed (runtime-shared) source alone.

## Symmetry: the core data path

`typedArrayForColumn` is the same shape of problem with a different input
format: it is the CPU lowering every column passes through before `<RawData>`,
and for a caller who already owns typed data (Arrow, a typed column, a fetched
binary blob) it buys nothing. `gggplot-vs7.10` applies this ADR's contracts to
that path — a column loader producing a `StorageSource` directly, with the
existing `Column` path unchanged.
