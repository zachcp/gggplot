"""Dependency-free SafeTensors writer.

The format is small enough to implement directly, which keeps the bridge
runnable in a bare Python environment. Depending on the ``safetensors``
package would add an install step to the one tool whose whole purpose is to
get data *out* of a heavyweight ecosystem.
"""

from __future__ import annotations

import json
import struct
from dataclasses import dataclass
from typing import Iterable

# SafeTensors dtype spellings mapped to (struct format, byte width).
_DTYPES = {
    "F32": ("f", 4),
    "F64": ("d", 8),
    "I8": ("b", 1),
    "I16": ("h", 2),
    "I32": ("i", 4),
    "I64": ("q", 8),
    "U8": ("B", 1),
    "U16": ("H", 2),
    "U32": ("I", 4),
    "U64": ("Q", 8),
}


@dataclass(frozen=True)
class Tensor:
    """One named tensor: a dtype, a shape, and row-major values."""

    name: str
    dtype: str
    shape: tuple[int, ...]
    values: tuple[float, ...]

    def __post_init__(self) -> None:
        if self.dtype not in _DTYPES:
            raise ValueError(
                f"unsupported dtype {self.dtype!r}; "
                f"expected one of {sorted(_DTYPES)}"
            )
        expected = 1
        for dimension in self.shape:
            if dimension < 0:
                raise ValueError(f"tensor {self.name} has a negative dimension")
            expected *= dimension
        if len(self.values) != expected:
            raise ValueError(
                f"tensor {self.name} declares shape {list(self.shape)} "
                f"({expected} values) but carries {len(self.values)}"
            )

    @property
    def byte_length(self) -> int:
        return len(self.values) * _DTYPES[self.dtype][1]

    def pack(self) -> bytes:
        fmt, _ = _DTYPES[self.dtype]
        return struct.pack(f"<{len(self.values)}{fmt}", *self.values)


def write_safetensors(
    tensors: Iterable[Tensor],
    metadata: dict[str, str] | None = None,
) -> bytes:
    """Serialize tensors into SafeTensors bytes.

    Layout is an 8-byte little-endian header length, a JSON header, then the
    concatenated payload. Offsets in the header are relative to the start of
    that payload, not the file.
    """
    ordered = list(tensors)
    header: dict[str, object] = {}
    if metadata:
        header["__metadata__"] = dict(metadata)
    offset = 0
    payload = bytearray()
    for tensor in ordered:
        end = offset + tensor.byte_length
        header[tensor.name] = {
            "dtype": tensor.dtype,
            "shape": list(tensor.shape),
            "data_offsets": [offset, end],
        }
        payload.extend(tensor.pack())
        offset = end
    encoded = json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    # The spec allows padding the header; keeping it exact makes the output
    # byte-reproducible, which is what lets a fixture be committed and diffed.
    return struct.pack("<Q", len(encoded)) + encoded + bytes(payload)
