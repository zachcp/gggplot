"""Tests for the bridge. These require no PyTorch and no third-party packages."""

from __future__ import annotations

import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from gggplot_bridge.cli import main  # noqa: E402
from gggplot_bridge.document import build_model_document, demo_tensors  # noqa: E402
from gggplot_bridge.safetensors_writer import Tensor, write_safetensors  # noqa: E402


class SafeTensorsWriterTest(unittest.TestCase):
    def test_layout_is_length_header_then_payload(self) -> None:
        payload = write_safetensors([Tensor("w", "F32", (2, 2), (1.0, 2.0, 3.0, 4.0))])
        header_length = struct.unpack("<Q", payload[:8])[0]
        header = json.loads(payload[8 : 8 + header_length])
        self.assertEqual(header["w"]["shape"], [2, 2])
        # Offsets are relative to the payload, not the file.
        self.assertEqual(header["w"]["data_offsets"], [0, 16])
        self.assertEqual(len(payload), 8 + header_length + 16)

    def test_offsets_run_consecutively(self) -> None:
        payload = write_safetensors(
            [
                Tensor("a", "F32", (2,), (1.0, 2.0)),
                Tensor("b", "F32", (3,), (3.0, 4.0, 5.0)),
            ]
        )
        header_length = struct.unpack("<Q", payload[:8])[0]
        header = json.loads(payload[8 : 8 + header_length])
        self.assertEqual(header["a"]["data_offsets"], [0, 8])
        self.assertEqual(header["b"]["data_offsets"], [8, 20])

    def test_output_is_byte_reproducible(self) -> None:
        # A committed fixture is only diffable if the writer is deterministic.
        first = write_safetensors(demo_tensors(), metadata={"produced_by": "x"})
        second = write_safetensors(demo_tensors(), metadata={"produced_by": "x"})
        self.assertEqual(first, second)

    def test_shape_and_values_must_agree(self) -> None:
        with self.assertRaisesRegex(ValueError, "carries"):
            Tensor("w", "F32", (2, 2), (1.0, 2.0))

    def test_unknown_dtype_is_refused(self) -> None:
        with self.assertRaisesRegex(ValueError, "unsupported dtype"):
            Tensor("w", "COMPLEX", (1,), (1.0,))


class DocumentTest(unittest.TestCase):
    def test_weights_only_export_states_it_has_no_graph(self) -> None:
        tensors = demo_tensors()
        document = build_model_document(
            "m", tensors, "file:m.safetensors", "m.safetensors", 100
        )
        self.assertEqual(document["graphs"][0]["nodes"], [])
        # "no topology" must be distinguishable from "topology we failed to read".
        self.assertEqual(document["metadata"]["graphStructure"], "none")
        self.assertIn("ONNX", document["metadata"]["graphStructureReason"])

    def test_payload_offsets_match_writer_order(self) -> None:
        tensors = demo_tensors()
        document = build_model_document(
            "m", tensors, "file:m.safetensors", "m.safetensors", 100
        )
        offset = 0
        for tensor in tensors:
            descriptor = document["tensors"][
                f"safetensors:file:m.safetensors:tensor:{tensor.name}"
            ]
            self.assertEqual(descriptor["payload"]["byteOffset"], offset)
            offset += tensor.byte_length


class CliTest(unittest.TestCase):
    def test_demo_writes_both_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(main(["--demo", "--out-dir", directory]), 0)
            out = Path(directory)
            self.assertTrue((out / "tiny-mlp.safetensors").is_file())
            self.assertTrue((out / "tiny-mlp.model.json").is_file())

    def test_unsupported_input_is_refused(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            code = main(["--input", "model.onnx", "--out-dir", directory])
            self.assertEqual(code, 2)

    def test_pickle_is_not_read_without_torch(self) -> None:
        # The refusal must be explicit rather than a stack trace.
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(main(["--input", "m.pt", "--out-dir", directory]), 2)


if __name__ == "__main__":
    unittest.main()
