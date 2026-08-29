# `@gggplot/model-inspect` loaders

`inspectSafeTensors()` and `inspectOnnx()` inspect portable model artifacts
without executing model code or eagerly copying tensor payloads. Both return a
serializable `ModelDocument` and a `TensorSource`; callers must request a
validated byte range before any selected payload is copied.

The ONNX loader reads the main `ModelProto` graph, node I/O, initializers, typed
value metadata, opsets, and payload ranges. ONNX Runtime Web is not required for
this inspection path. `raw_data` initializers and supported packed numeric
repeated fields can be read lazily from the returned source; `external_data`
requires a host-provided source mapping.

The first direct ONNX slice reports, but does not expand, subgraphs embedded in
control-flow attributes (`If`, `Loop`, `Scan`, and custom operators). Static
graph metadata must not be presented as a runtime execution trace. Runtime
activations and dynamically selected graph branches belong to a separate runtime
adapter and retain their own provenance.

Inputs are bounded before protobuf/JSON decoding. Hosts should set lower limits
than the defaults when accepting untrusted uploads, and should provide
range-capable sources for external or remote payloads rather than loading a
whole artifact merely to inspect one tensor.

## Inspection products

`buildGeometryProduct()` derives `geom_loading`: renderer-neutral 2.5D block,
operator, port, routed-edge, and label instances. Every instance has a stable
entity index that resolves to canonical graph/node/value/tensor IDs. Geometry
contains no numeric tensor values; useGPU hosts may pack it into their own
instance and segment buffers. Exporter-supplied `scopePath` or `parentId`
creates nested block outlines, but the ONNX loader never invents module names.

`buildTensorContentProduct()` derives `matrix_content` for a tensor or runtime
artifact. Its explicit policy returns exact values, a bounded tile, a bounded
downsampled grid, an evenly sampled summary, or metadata only. The default
limits are 16 MiB resident / 4 MiB exact-or-tile / 512² overview cells; callers
can narrow them per request but cannot force an allocation that exceeds them.
High-rank matrix views require the trailing displayed axes and fixed indices for
every hidden axis. The product records source/version/range/layout/cache
identity, so the residency adapter can keep a selected tile GPU-resident across
camera and selection changes without any implicit GPU readback.

## 3D model scenes

`buildModelScene3D()` derives a renderer-neutral perspective scene from a
`ModelDocument`. Its independent layout strategies place operator modules by
graph depth, tile bounded tensor slabs in local module space, and route data
flow as depth-aware connector paths. Stable entity IDs on modules, slabs, and
connectors preserve selection and inspection identity across orbit, pan, and
zoom. The scene only carries display extents, source ranges, and cache
identities—not tensor values—so the renderer can keep view geometry resident
while tensor content remains demand-driven.
