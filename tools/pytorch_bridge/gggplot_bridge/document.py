"""Build a gggplot model document from tensor metadata.

The document mirrors ``gggplot.model@1`` as defined in
``packages/model-inspect/src/types.ts``. It carries descriptors and byte
ranges only — never tensor payloads — so it stays small and inspectable.
"""

from __future__ import annotations

from typing import Iterable, Sequence

from .safetensors_writer import Tensor

_DTYPE_TO_MODEL = {
    "F16": "f16",
    "F32": "f32",
    "F64": "f64",
    "BF16": "bf16",
    "I8": "i8",
    "I16": "i16",
    "I32": "i32",
    "I64": "i64",
    "U8": "u8",
    "U16": "u16",
    "U32": "u32",
    "U64": "u64",
    "BOOL": "bool",
}


def build_model_document(
    model_id: str,
    tensors: Sequence[Tensor],
    source_id: str,
    source_uri: str,
    byte_length: int,
    framework: dict[str, str] | None = None,
) -> dict:
    """Produce a ModelDocument for a weights-only export.

    A ``state_dict`` has no topology: it is a mapping of names to weights, with
    no record of how they were wired together. The emitted graph therefore has
    no nodes or edges, and says so through metadata rather than inventing a
    structure the source never contained. Export via ONNX when the graph
    matters.
    """
    descriptors = {}
    offset = 0
    for tensor in tensors:
        identifier = f"safetensors:{source_id}:tensor:{tensor.name}"
        descriptors[identifier] = {
            "id": identifier,
            "name": tensor.name,
            "dtype": _DTYPE_TO_MODEL.get(tensor.dtype, tensor.dtype.lower()),
            "shape": list(tensor.shape),
            "byteLength": tensor.byte_length,
            "role": "parameter",
            "payload": {
                "sourceId": source_id,
                "byteOffset": offset,
                "byteLength": tensor.byte_length,
                "encoding": "safetensors",
            },
        }
        offset += tensor.byte_length

    return {
        "schema": "gggplot.model@1",
        "id": model_id,
        "name": model_id,
        "framework": framework or {"name": "PyTorch", "dialect": "state_dict"},
        "source": {
            "id": source_id,
            "format": "safetensors",
            "kind": "file",
            "uri": source_uri,
            "byteLength": byte_length,
        },
        "graphs": [
            {
                "id": f"{model_id}:parameters",
                "name": "parameters",
                "inputs": [],
                "outputs": [],
                "nodes": [],
                "edges": [],
            }
        ],
        "tensors": descriptors,
        "metadata": {
            "bridge": "gggplot-pytorch-bridge",
            "graphStructure": "none",
            "graphStructureReason": (
                "a state_dict records weights, not topology; "
                "export to ONNX when graph structure is required"
            ),
        },
    }


def demo_tensors() -> list[Tensor]:
    """A tiny deterministic MLP, shaped exactly like a real state_dict export.

    Values are generated arithmetically rather than randomly so the fixture is
    byte-reproducible and a committed copy can be diffed.
    """
    def ramp(count: int, scale: float) -> tuple[float, ...]:
        return tuple(round((index + 1) * scale, 4) for index in range(count))

    return [
        Tensor("layers.0.weight", "F32", (4, 3), ramp(12, 0.01)),
        Tensor("layers.0.bias", "F32", (4,), ramp(4, 0.1)),
        Tensor("layers.2.weight", "F32", (2, 4), ramp(8, 0.02)),
        Tensor("layers.2.bias", "F32", (2,), ramp(2, 0.5)),
    ]


def tensors_from_state_dict(state_dict: Iterable[tuple[str, object]]) -> list[Tensor]:
    """Convert a torch ``state_dict`` into writer tensors.

    ``torch`` is imported by the caller, not here: this module stays importable
    and testable in an environment with no PyTorch installed.
    """
    tensors: list[Tensor] = []
    for name, value in state_dict:
        detached = value.detach().to("cpu").contiguous()  # type: ignore[attr-defined]
        dtype = str(detached.dtype).removeprefix("torch.")
        spelling = {
            "float32": "F32",
            "float64": "F64",
            "int8": "I8",
            "int16": "I16",
            "int32": "I32",
            "int64": "I64",
            "uint8": "U8",
        }.get(dtype)
        if spelling is None:
            raise ValueError(
                f"tensor {name!r} has dtype {dtype!r}, which this bridge does "
                "not convert; cast it before exporting"
            )
        tensors.append(
            Tensor(
                name=name,
                dtype=spelling,
                shape=tuple(detached.shape),
                values=tuple(detached.flatten().tolist()),
            )
        )
    return tensors
