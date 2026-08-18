# Model inspection package plan

Status: design scope for `gggplot-i5m` (2026-08-02)

## Recommendation

Build a separate package, tentatively `@gggplot/model-inspect`, with five
layers:

```text
artifact adapters
  -> canonical model document
  -> inspection products
  -> view specifications
  -> useGPU / gggplot adapters
```

The package should be an inspection and visualization system, not a general
model runtime. Its first job is to answer: “What is in this model, how does
data flow through it, and what tensors or runtime observations are attached to
each part?” Running inference can be added later through an explicit host
adapter.

## Similar solutions and what to borrow

| Existing solution | Strong idea | Boundary for this package |
| --- | --- | --- |
| Netron | Graph-first exploration across many model formats | Borrow the graph/node/value vocabulary; add linked tensor and runtime views rather than reproducing a full format zoo initially. |
| ONNX IR | Portable graph, node, value, initializer, and symbolic-shape model | Borrow stable IDs, typed values, symbolic dimensions, and opset/provenance metadata. Do not make ONNX the only internal representation. |
| SafeTensors | Safe, inspectable tensor payload with metadata and slices | Use as a preferred browser payload; keep payload access lazy and bounded. |
| `torch.export` / FX | Extracts a PyTorch computation graph plus state and call metadata | Use in a Python conversion bridge; do not load its serialized archive directly in an untrusted browser context. |
| TensorBoard graphs and projector | Separates graph structure from runtime summaries and embeddings | Borrow the idea of runtime artifacts linked by stable node/tensor IDs. |
| Model summaries / parameter tables | Compact layer inventory and parameter accounting | Make this a first-class product, not merely text generated beside the graph. |

The key design choice is to represent the model once, then derive several
coordinated visual products. A graph, a tensor matrix, and an embedding plot
should share selection identity even though they have different rendering
topologies.

## Scope and non-goals

### In scope for the first package

- Model graph structure: nodes, edges, inputs, outputs, modules, operators.
- Tensor descriptors: shape, symbolic dimensions, dtype, device, byte size,
  layout, quantization metadata, and source location.
- Parameter inventory and summaries: count, min/max, mean, standard deviation,
  sparsity, and optional histograms.
- Lazy tensor access for bounded slices and summaries.
- Layer selection and linked highlighting across all views.
- SafeTensors and ONNX metadata loaders.
- A Python-side PyTorch export bridge that emits the canonical document and/or
  SafeTensors, with an explicit trust boundary.
- useGPU views for graph, tensor inventory/matrix, parameter summary, and
  optional embedding/activation data.

### Explicitly out of scope initially

- Browser execution of arbitrary PyTorch, TorchScript, `.pt`, or pickle files.
- Training, optimization, gradient computation, or full inference runtime.
- Automatic conversion of every framework format.
- A generic 3D scene graph for arbitrary neural-network layouts.
- Claiming that static graph structure is the same as runtime execution for
  dynamic control flow.

## Canonical model document

The document is JSON-serializable and contains references to payload providers;
it never contains GPU handles, functions, framework objects, or unbounded raw
tensor arrays.

```ts
interface ModelDocument {
  schema: "gggplot.model@1";
  id: string;
  name?: string;
  framework?: { name: string; version?: string; dialect?: string };
  source: ArtifactSource;
  graphs: ModelGraph[];
  tensors: Record<string, TensorDescriptor>;
  artifacts?: RuntimeArtifact[];
  metadata?: Record<string, string | number | boolean | null>;
}

interface ModelGraph {
  id: string;
  name?: string;
  inputs: ValueRef[];
  outputs: ValueRef[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  id: string;
  kind: "module" | "operator" | "constant" | "input" | "output" | "unknown";
  name?: string;
  op?: string;
  domain?: string;
  attributes?: Record<string, JsonValue>;
  inputs: ValueRef[];
  outputs: ValueRef[];
  parameters?: string[];
  source?: SourceLocation;
}

interface TensorDescriptor {
  id: string;
  name?: string;
  dtype: string;
  shape: Dimension[];
  device?: string;
  byteLength?: number;
  role: "input" | "output" | "parameter" | "buffer" | "activation" | "constant";
  payload?: PayloadRef;
  summary?: TensorSummary;
}

type Dimension = number | { symbol: string; value?: number } | { unknown: true };
```

`ValueRef` should point to a tensor descriptor or an intermediate graph value.
The distinction matters: graph values can have symbolic or unknown shapes,
while a parameter payload may have a concrete storage descriptor. Shapes should
retain rank and symbolic names rather than collapsing everything to a flat
product.

## GPU-resident representation

GPU residency is part of the package contract, not an optimization left to the
view implementation. The model document is the control plane; source-backed
GPU buffers are the data plane.

### Two planes

**Control plane (CPU/serializable):** model metadata, graph topology, tensor
descriptors, logical dtype, symbolic shape, source URI or file identity,
summary values, residency policy, cache keys, and current selection state.

**Data plane (GPU-resident when eligible):** positions, edges, tensor values,
summary grids, embeddings, activation samples, attention tiles, and compact
integer IDs used for picking and cross-view linking.

The control plane must never embed a GPU handle. A product can refer to a data
plane allocation through a stable `sourceId` plus a byte range, shape, strides,
and physical format. The runtime adapter resolves that reference to a
source-backed buffer or texture and owns its lifetime.

### Logical tensor versus physical buffer

The logical tensor preserves the model's meaning:

```ts
interface TensorStorage {
  sourceId: string;
  byteOffset: number;
  byteLength: number;
  dtype: "f16" | "f32" | "f64" | "i8" | "i16" | "i32" | "i64" |
    "u8" | "u16" | "u32" | "bool";
  shape: number[];
  strides?: number[];
  order: "row-major" | "column-major" | "strided";
  physical?: {
    bufferFormat: "f16" | "f32" | "u32" | "i32" | "rgba32float";
    components: 1 | 2 | 4;
    conversion?: "none" | "normalize" | "dequantize";
  };
}

interface ResidencySpec {
  policy: "metadata" | "summary" | "range" | "resident";
  cacheKey: string;
  upload: "never" | "on-demand" | "once" | "streamed";
  maxBytes?: number;
  readback: "never" | "summary-only" | "explicit";
}
```

The logical dtype and shape stay authoritative even when a view converts data
to a renderer-friendly physical layout. For example, a tensor matrix may use
an `rgba32float` texture for four scalar cells per texel, while a graph's node
positions use an interleaved `vec2` buffer and its edges use a `u32` index
buffer. The conversion must be declared, bounded, and keyed in the cache.

### Product residency matrix

| Product | Default residency | GPU representation | CPU responsibility |
| --- | --- | --- | --- |
| Layer graph | Resident after layout | node positions, style/selection IDs, edge index/segment buffers | graph extraction and layout invalidation |
| Shape flow | Resident after product build | compact edge geometry plus small shape-label metadata | symbolic shape formatting |
| Tensor inventory | Metadata/summary | optional bar/treemap geometry and numeric metrics | descriptor indexing and filtering |
| Parameter treemap | Resident geometry; values as small buffers | rect positions, tensor IDs, parameter sizes/colors | hierarchy and layout |
| Tensor matrix | On-demand range, then resident | storage buffer or texture with declared slice/axis mapping | slice selection and axis labels |
| Activation/embedding | Resident only for bounded samples | point positions, IDs, optional colors/labels | sampling/reduction policy |
| Attention | On-demand tiles, optionally resident | tiled scalar texture/buffer plus head/query/key indices | semantic-axis selection and tile requests |

Large parameter payloads should remain in the source provider until a view asks
for a bounded range. A parameter inventory should not upload the parameter
values merely because it displays parameter counts. Conversely, a selected
matrix should be uploaded once and reused across pan, zoom, color-scale, and
selection changes.

### Source-backed lifecycle

```text
MetadataOnly
  -> SummaryResident       (bounded statistics available)
  -> RangeResident         (requested slice uploaded)
  -> ProductResident       (derived geometry/texture uploaded)
  -> Evicted               (budget pressure or source change)
```

Each state is keyed by source identity, byte range, logical shape/strides,
physical format, product parameters, and source version. A view update should
behave as follows:

- Camera, zoom, pan, color range, and selection update uniforms or small state;
  they do not repack tensor data.
- A new tensor slice or axis selection uploads only the requested range and
  invalidates the dependent product, not the entire model.
- A source replacement or dtype/shape change invalidates dependent buffers.
- A graph layout change rebuilds node/edge geometry but does not touch tensor
  payload buffers.
- Readback is limited to summaries or explicit user requests; it is never an
  implicit part of a render frame.

This should use the same reference-identity and zero-reupload discipline as the
existing core residency path. Runtime adapters may use `useRawSource`, storage
buffers, textures, or future equivalent primitives, but the product contract
must describe the source and cache identity independently of that choice.

### Buffer layout rules

1. Store positions and other frequently transformed geometry interleaved when
   the renderer consumes vector attributes; store scalar fields separately
   when views update or select them independently.
2. Keep integer IDs separate from float display attributes so picking and
   cross-view linkage do not depend on color encoding.
3. Preserve tensor strides and axis labels. A view may create a contiguous
   staging range, but it must record the selected axes and transformation.
4. Use typed storage where the shader path supports it; otherwise convert to a
   declared physical format once and cache the converted range.
5. Bound every resident allocation by product and session budgets. Large or
   sparse tensors need summaries, tiled ranges, or sampled products rather than
   unconditional dense uploads.
6. Make missing, NaN, quantized, and masked values explicit in the product
   metadata and shader path; do not silently turn them into zero.

The implementation issue for this design is `gggplot-i5m.9`. It must land
between the canonical IR and the view work so that views cannot accidentally
reintroduce per-frame CPU packing or whole-model readback.

## JavaScript-native loading and inference

Before adding a custom PyTorch runtime, evaluate JavaScript-native adapters.
Transformers.js provides a high-level pipeline API over converted model
artifacts and supports selecting a WebGPU device. ONNX Runtime Web provides a
lower-level JavaScript/TypeScript session API, including WebGPU execution and
paths for keeping tensor data on the GPU. These are complementary layers, not
competing canonical model formats.

### Proposed adapter roles

```text
Transformers.js                 high-level task pipeline / model hub loading
       │
       ├── runtime artifacts: embeddings, logits, selected activations
       │
ONNX Runtime Web                session, graph execution, tensor ownership
       │
       ├── canonical document + bounded tensor sources
       │
useGPU residency adapter         visualization buffers, textures, products
```

Transformers.js is useful for the user-facing “load a model and inspect a
result” flow, especially embeddings and task outputs. It should not be assumed
to expose every internal module, operator, or intermediate tensor. When full
graph structure is needed, the adapter should inspect the underlying ONNX
artifacts or accept an explicit model document. When layer activations are
needed, the runtime adapter should request or instrument those outputs and
attach them to stable node/tensor IDs as runtime artifacts.

ONNX Runtime Web is useful for the lower-level ownership and execution
experiment. Its WebGPU path can keep tensors on the GPU through explicit GPU
tensor/I/O-binding mechanisms, but the model-inspection package must not assume
that an ONNX Runtime tensor is automatically compatible with a useGPU source.
The runtime and visualization layer may have different devices, allocators,
buffer usages, alignment rules, or shader layouts.

### Two ownership modes

The adapter must make ownership explicit:

| Mode | When to use | Data movement |
| --- | --- | --- |
| `visualizer-owned` | Inspecting a bounded tensor, graph product, embedding, or activation sample | Loader/runtime produces a typed range or summary; the residency adapter uploads once into a useGPU-owned source/buffer and reuses it. |
| `runtime-shared` | Inference output is already on the same WebGPU device and the buffer layout/usage is compatible | The view consumes a validated runtime-owned tensor or shared buffer through an adapter; no CPU round-trip. |
| `runtime-copy-on-demand` | Runtime device or buffer contract is opaque/incompatible | Copy only the requested range/output into a useGPU-owned buffer; preserve the source/version/cache key. |

`runtime-shared` is an optimization, not the semantic contract. The canonical
document and products must work in `visualizer-owned` mode so the package does
not become coupled to a specific inference runtime. A shared path must validate
device identity, buffer usage, dtype, shape, strides, byte range, synchronization
and lifetime. If any check fails, it falls back to a bounded copy rather than
silently reading back through the CPU.

### Post-loading storage policy

Loading and visualization should be separate phases:

1. Load model metadata and graph structure.
2. Load or execute only the tensor ranges needed by the selected product.
3. Normalize the result into a `TensorSource` with logical shape/dtype/strides
   and ownership metadata.
4. Let the useGPU residency adapter choose a buffer or texture layout,
   allocation budget, cache key, and eviction policy.
5. Derive graph/tensor/embedding/attention products from the resident source.
6. Keep selection, camera, axis slicing, color scales, and hover state out of
   the tensor payload so those updates do not trigger re-upload.

This lets Transformers.js own model acquisition and inference while useGPU
owns the visualization lifetime. It also supports a no-inference inspection
mode using ONNX/SafeTensors metadata only.

### Runtime capability contract

The runtime adapter should report capabilities rather than make the renderer
guess:

```ts
interface ModelRuntimeCapabilities {
  runtime: "transformers-js" | "onnxruntime-web" | "other";
  execution: "wasm" | "webgpu" | "webnn" | "unknown";
  graphMetadata: "none" | "partial" | "full";
  intermediateOutputs: "none" | "selected" | "all";
  gpuTensorInterop: "none" | "copy" | "shared";
  externalData: boolean;
  quantizedDtypes: string[];
}
```

The first vertical slice should support Transformers.js/ONNX Runtime Web for a
small ONNX model, capture one selected output or embedding, and store that
output in a useGPU-owned buffer. A follow-up experiment can measure whether a
same-device shared buffer is worthwhile for this repository's actual useGPU
runtime. The capability report and upload instrumentation belong in
`gggplot-i5m.10` and `gggplot-i5m.7`.

### Decision: the first supported runtime path

Recorded 2026-08-18 for `gggplot-i5m.10`.

**Static ONNX parsing is the first supported path, and no inference runtime is
a dependency of inspection.** `inspectOnnx` reads the portable artifact
directly and yields the full operator graph, initializer ranges, and provenance
without executing the model. That is strictly better than obtaining structure
from a runtime session: it is faster, it needs no GPU, it runs in Deno and Node
as readily as a browser, and it never executes untrusted model code. It is also
what the docs route ships today.

| Path | Graph structure | Activations | Cost to inspect | Verdict |
| --- | --- | --- | --- | --- |
| Direct ONNX parse (`inspectOnnx`) | Full operator graph | None — static only | Zero runtime deps | **Default.** Structure authority |
| ONNX Runtime Web | Full, but only via a session | Selected outputs; shared GPU tensors possible | 14–24 MB WASM, WebGPU device | Opt-in, for activation capture |
| Transformers.js | Partial; hides internal modules | Task outputs, embeddings | ORT underneath, plus hub loading | Not adopted |
| `fixtureRuntimeAdapter` | Whatever the fixture declares | Pre-recorded | None | Contract tests and reference |

Transformers.js is **not adopted**. It sits on top of ONNX Runtime Web, so it
adds its cost without adding graph fidelity — it reports `graphMetadata:
"partial"` precisely because its pipeline abstraction hides the internal
modules an inspector exists to show. Where its task-level outputs are wanted
later, it can arrive as another `ModelRuntimeAdapter` behind the same contract;
nothing in the package needs to change to accommodate it. Its capability
profile is retained in `TRANSFORMERS_JS_WEBGPU_CAPABILITIES` so the comparison
stays executable rather than living only in this document.

A runtime is therefore needed for exactly one thing: **capturing activations**,
which static parsing cannot provide. ONNX Runtime Web is the choice there, kept
behind a dynamic import so the inspection route never pays for it (see the
runtime bundle budget above).

### What the fixture adapter is for

`fixtureRuntimeAdapter` implements the full `ModelRuntimeAdapter` contract,
including the `capture` half that every real runtime leaves untested in CI
because it needs a browser, a device, and a large WASM payload. It executes no
model code and runs anywhere Deno or Node does, so the rules an adapter must
enforce are asserted on every test run:

- A capture over `maxBytes` **fails** rather than returning a short read, so
  partial data is never presented as a whole tensor.
- A capture may not answer for a different `nodeId` or `tensorId` than the one
  requested, which would corrupt the stable-ID linkage products rely on.
- `runtime-shared` is granted only when the runtime reports `gpuTensorInterop:
  "shared"` *and* the binding passes `sharedTensorCompatibility`; anything else
  degrades to `runtime-copy-on-demand` rather than silently sharing.
- The granted ownership is reported on the output, so a consumer never has to
  infer the mode from whether a GPU binding happens to be populated.

Validating a genuinely same-device shared tensor still requires a real WebGPU
device and a real ORT session, which no headless test can stand in for. That
remains browser QA rather than something the fixture can honestly claim.

## Products and visual surfaces

The package should expose products that are derived from the document. Products
are bounded, serializable summaries suitable for a RenderTree or a host UI.

### 1. Layer graph

Input: `ModelGraph`.

Output: positioned node/edge arrays with hierarchy, layer type, parameter
count, and status flags. This is the Netron-like view, but layout is a product
so the host can replace the layout algorithm without changing the model IR.

### 2. Shape-flow diagram

Input: graph values and tensor descriptors.

Output: edges annotated with rank, shape, dtype, and byte size. This should be a
separate product from the graph because shape-flow can be shown as a compact
pipeline even when the full operator graph is too dense.

### 3. Tensor inventory and parameter treemap

Input: parameter/buffer descriptors and summaries.

Output: rows or rectangles keyed by tensor ID, with size, dtype, layer, and
summary metrics. This gives a useful model-level view without uploading tensor
contents.

### 4. Tensor matrix / heatmap

Input: a selected 1D/2D tensor or a bounded projection of a higher-rank tensor.

Output: a resident numeric grid plus scale metadata. Higher-rank tensors need
an explicit slice/reshape policy; never silently flatten them without showing
the selected axes.

### 5. Activation and embedding views

Input: runtime artifacts linked to node/tensor IDs.

Output: point-cloud or density products with provenance, sample count, and
reduction metadata. These are optional because they require a host inference
or tracing pipeline; the package should still render a model with no runtime
artifacts.

### 6. Attention view

Input: an explicitly identified attention artifact with head/query/key axes.

Output: matrix tiles or compact small multiples. Attention should not be
inferred merely from tensor rank; the artifact must declare semantic axes.

## Extension taxonomy

Recorded 2026-08-18 for `gggplot-i5m.6`. Definitions live in
`packages/model-inspect/src/extensions.ts`.

| Extension | Class | Why |
| --- | --- | --- |
| `model_tensor_inventory` | ordinary | One row per tensor. A bar chart over a table needs no special renderer. |
| `model_graph` | specialized | Topology, not rows — nodes, ports, and routed edges have no tabular equivalent. |
| `model_tensor_matrix` | specialized | A bounded grid whose content policy picks the representation before anything is drawn. |
| `model_scene_3d` | specialized | Slabs, modules, and connectors positioned in space. |

The split is legible in the definitions themselves rather than only here: the
ordinary extension emits `shape: "row"` fields, while the specialized ones emit
`topology` or `grid`. A test asserts that correspondence, so the taxonomy
cannot drift from the data it describes.

`model_embedding`, `model_activation`, and `model_attention` appear in the
design but are deliberately **not registered**. An embedding is an ordinary
point chart once something produces coordinates, and both activations and
attention require runtime capture that is not wired up. Registering them now
would declare capability the package cannot honour.

### Where capabilities are declared

Every packaged definition declares `cpu` and nothing else. The package computes
products; it does not draw them. A host that renders registers the same
definitions with `live` and `emit` adapters added — `renderableDefinition()`
republishes rather than mutating, so the package's exported definition is never
altered by having been rendered somewhere.

This is what keeps framework-specific loaders out of core. Core's registry
holds a serializable definition plus opaque adapters; it never imports the
inspection package, and the `emit` adapter names a static import rather than a
serialized closure, so emitted source resolves the builder on its own.

The registry enforces the boundary rather than trusting it. Declared
capabilities must match supplied adapters exactly, and that check caught a real
inconsistency while this landed: `model_tensor_matrix` declared `cpu` but
supplied no adapter, because unlike the others it needs a `TensorSource` and a
view request to read a bounded range. The fix was to supply the adapter and
have it say plainly what it requires, rather than to quietly drop the
declaration.

## Rendering and integration boundary

The core package already has the right separation: serializable plans and
RenderTree nodes on one side, opaque Live/GPU adapters on the other. The model
package should follow that pattern:

- `@gggplot/model-inspect/ir`: document and product types plus validators.
- `@gggplot/model-inspect/loaders`: SafeTensors, ONNX, Transformers.js, ONNX
  Runtime Web, and conversion-bridge interfaces.
- `@gggplot/model-inspect/products`: graph layout, shape flow, tensor summaries,
  matrices, embeddings, and attention products.
- `@gggplot/model-inspect/views`: useGPU components and interaction state.
- `@gggplot/model-inspect/runtime`: runtime capability reports, tensor-source
  ownership, bounded output capture, and optional shared-device adapters.
- `@gggplot/model-inspect/gggplot`: optional extension definitions such as
  `geom_model_graph`, `geom_tensor`, and `geom_embedding`.

The ordinary gggplot grammar is a good fit for derived tabular products such
as parameter inventories, layer metrics, and embeddings. Specialized graph,
matrix, and attention views should remain package-owned components exposed
through explicit Live/emitted adapters. They should not be forced into
`GeomKind` or the core 2D/3D dimension resolver.

## PyTorch bridge format decision

Recorded 2026-08-18 for `gggplot-i5m.4`. Implementation in
`tools/pytorch_bridge/`.

**The bridge accepts a `state_dict` and emits SafeTensors plus a
`gggplot.model@1` document.** It deliberately does not define a new
interchange format: the inspector already parses two portable ones, and a third
would be a format to maintain rather than a capability to gain.

It runs host-side only. Reading a PyTorch artifact means unpickling, unpickling
executes code from the file, and that belongs on a trusted machine — never in a
browser and never against a user-supplied artifact. `weights_only=True` is the
default; full unpickling requires an explicit flag and warns before proceeding.
The browser side never sees a `.pt`.

PT2 `ExportedProgram` is **not** accepted. It would require executing or
unpickling a program graph for structure that `torch.onnx.export` already
provides in a portable form the package parses statically.

### A state_dict has no graph

A `state_dict` maps names to weights and records nothing about how they were
wired. The emitted document therefore has no nodes and no edges, and marks that
explicitly with `graphStructure: "none"` plus a reason. A consumer has to be
able to distinguish "this model has no topology" from "we failed to read the
topology", and only an explicit statement makes that possible. Export to ONNX
when structure matters.

### Tested across the language boundary

The Python writer is deterministic, so `--demo` produces a byte-reproducible
fixture that is committed under `packages/model-inspect/tests/fixtures/` and
read back by `bridge_fixture_test.ts`. That test asserts the two sides agree on
names, dtypes, shapes, and byte ranges, and that the values Python wrote are
the values TypeScript reads. A contract break on either side fails there rather
than in a browser.

Verifying the bridge against a real `.pt` requires PyTorch, which is not
installed in this repository's toolchain; the torch-reading path is therefore
covered by its refusal behaviour and by review, not by an executed test.

## Artifact and trust policy

| Input | First-class status | Reason |
| --- | --- | --- |
| SafeTensors | Yes, browser-safe metadata and lazy slices | Safe payload format with useful tensor metadata. |
| ONNX | Yes, metadata and graph inspection | Portable graph and shape vocabulary; payload loading can be staged. |
| Transformers.js | Yes, as a JS runtime/source adapter | High-level loading and inference path; use its outputs and capability reports, but do not require it to expose the complete internal graph. |
| ONNX Runtime Web | Yes, as a lower-level JS/WebGPU adapter | Session execution and GPU tensor ownership experiments; shared buffers require explicit validation. |
| PyTorch `state_dict` | Via Python/CLI bridge | Convert names, shapes, dtypes, and optional safe payloads. |
| `torch.export` / PT2 archive | Via trusted Python bridge only | Useful graph extraction, but current loading uses pickle and carries an explicit untrusted-input warning. |
| TorchScript / arbitrary `.pt` | No direct browser loader initially | Format/runtime variation and code-execution risk. |
| GGUF and other formats | Future adapter issue | Add only when a concrete visualization use case justifies it. |

The browser API should accept a `ModelSource` abstraction rather than a file
extension switch. A source can provide a document, metadata bytes, or bounded
tensor ranges. That lets a server-side converter, local file, or remote
sharded artifact use the same view layer.

## Runtime bundle and WASM budget

Measured on the docs site (`deno task build`, 2026-08-18):

| Build | `dist` total | Notes |
| --- | --- | --- |
| ORT assets copied unconditionally | 26 MB | `dist/ort/` alone was 23 MB |
| ORT assets gated on use | 2.4 MB | 1.6 MB `assets`, 720 KB fonts, 116 KB fixtures |

The docs model-inspection route never imports `onnxruntime-web`. It inspects
ONNX statically through `inspectOnnx`, which parses the portable artifact
directly and executes nothing. The runtime adapter remains a contract in
`runtime.ts` with ORT as one named implementation, but no code path loads it,
so the JS bundle cost of ORT today is zero and the route is responsive before
a user chooses a file.

The remaining cost was therefore not the bundle but the asset copy: the Vite
plugin staged ORT's WASM into `dist/ort/` on every build for a runtime nothing
loaded. That copy is now conditional on the emitted bundle actually referencing
ORT, so the assets ship exactly when they are needed and cannot silently go
missing the day the adapter is wired in. Dev always serves the route.

### WASM variant selection

If the runtime path is enabled, the variant matters more than anything else in
the budget:

| Variant | Size | When it applies |
| --- | --- | --- |
| `ort-wasm-simd-threaded.jsep.wasm` | 25.6 MB | Older WebGPU path |
| `ort-wasm-simd-threaded.asyncify.wasm` | 23.1 MB | Currently pinned; broadest WebGPU support |
| `ort-wasm-simd-threaded.jspi.wasm` | 14.3 MB | WebGPU via JS Promise Integration; needs recent browsers |
| `ort-wasm-simd-threaded.wasm` | 12.9 MB | CPU only, no WebGPU |

Prefer `jspi` where the browser supports it — roughly 40% smaller than the
asyncify build for the same WebGPU capability — and fall back to asyncify
otherwise. The plain SIMD-threaded build is the no-WebGPU fallback and should
be paired with a visible notice that inspection is running on CPU, since
threaded WASM additionally requires cross-origin isolation. Any of these
belongs behind a dynamic `import()` triggered by an explicit user action, never
on route load.

## Delivery sequence

1. `.1`: package boundary, threat model, and source policy.
2. `.8`: visual grammar and cross-view selection model.
3. `.2`: canonical document and tensor IR.
4. `.9`: GPU-resident layout, lifecycle, cache identity, and memory budgets.
5. `.10`: Transformers.js/ONNX Runtime Web adapter and ownership experiment.
6. `.3` and `.4`: SafeTensors/ONNX loaders and PyTorch conversion bridge.
7. `.5`: useGPU views and bounded resident products.
8. `.6`: gggplot extension definitions where the ordinary grammar is useful.
9. `.7`: gallery, limits, and performance gate.

The first vertical slice should be: one tiny exported model, graph + shape
flow + parameter inventory, no inference required, and a selected tensor
matrix. Activations, embeddings, and attention can then attach to the same
stable IDs without changing the document contract.
