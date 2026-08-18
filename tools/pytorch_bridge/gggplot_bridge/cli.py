"""CLI for the gggplot PyTorch export bridge.

The bridge runs on the trusted side of the boundary — your machine, not a
browser — and its job is to turn a PyTorch artifact into portable files the
inspector can read without executing anything.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .document import build_model_document, demo_tensors, tensors_from_state_dict
from .safetensors_writer import Tensor, write_safetensors

TRUST_WARNING = """\
TRUST WARNING
  Loading a pickled PyTorch artifact executes code from that file. Only do this
  for models you produced or otherwise trust completely. This bridge exists so
  that step happens here, deliberately, on your machine — never in a browser
  and never against an artifact a user supplied.
"""

# Formats the bridge accepts, and what each one can yield.
SAFE_SUFFIXES = {".safetensors"}
PICKLE_SUFFIXES = {".pt", ".pth", ".bin", ".ckpt"}


class BridgeError(Exception):
    """A refusal or a malformed input, reported without a traceback."""


def _load_state_dict(path: Path, allow_unsafe_pickle: bool) -> list[Tensor]:
    if path.suffix not in PICKLE_SUFFIXES:
        raise BridgeError(
            f"{path.name}: unsupported input. This bridge accepts "
            f"{sorted(PICKLE_SUFFIXES)} state_dict files, or use --demo."
        )
    try:
        import torch  # noqa: PLC0415 — optional, and only for this path
    except ModuleNotFoundError as error:
        raise BridgeError(
            "PyTorch is required to read a .pt state_dict. Install torch, or "
            "run with --demo to emit the bundled fixture instead."
        ) from error

    # weights_only=True refuses to unpickle arbitrary objects, which is the
    # whole safety argument for reading a state_dict at all.
    if allow_unsafe_pickle:
        sys.stderr.write(TRUST_WARNING)
        sys.stderr.write("  Proceeding with FULL unpickling at your request.\n")
        loaded = torch.load(path, map_location="cpu", weights_only=False)
    else:
        loaded = torch.load(path, map_location="cpu", weights_only=True)

    if not isinstance(loaded, dict):
        raise BridgeError(
            f"{path.name}: expected a state_dict mapping, got "
            f"{type(loaded).__name__}. A full module or TorchScript archive "
            "needs --allow-unsafe-pickle, and even then only the weights are "
            "converted; export to ONNX for graph structure."
        )
    return tensors_from_state_dict(loaded.items())


def convert(
    tensors: list[Tensor],
    model_id: str,
    out_dir: Path,
) -> tuple[Path, Path]:
    """Write the .safetensors payload and its model document beside it."""
    out_dir.mkdir(parents=True, exist_ok=True)
    weights_path = out_dir / f"{model_id}.safetensors"
    document_path = out_dir / f"{model_id}.model.json"

    payload = write_safetensors(tensors, metadata={"produced_by": "gggplot-bridge"})
    weights_path.write_bytes(payload)

    document = build_model_document(
        model_id=model_id,
        tensors=tensors,
        source_id=f"file:{weights_path.name}",
        source_uri=weights_path.name,
        byte_length=len(payload),
    )
    document_path.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n")
    return weights_path, document_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="gggplot-pytorch-bridge",
        description=(
            "Convert a PyTorch state_dict into SafeTensors plus a portable "
            "gggplot model document. Emits weights and metadata only; use "
            "torch.onnx.export when you need graph structure."
        ),
        epilog=TRUST_WARNING,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--input", type=Path, help="a .pt/.pth state_dict")
    parser.add_argument(
        "--demo",
        action="store_true",
        help="emit the bundled tiny MLP fixture; requires no PyTorch",
    )
    parser.add_argument("--name", default=None, help="model id for the outputs")
    parser.add_argument(
        "--out-dir", type=Path, default=Path("."), help="destination directory"
    )
    parser.add_argument(
        "--allow-unsafe-pickle",
        action="store_true",
        help="permit full unpickling, which EXECUTES CODE from the artifact",
    )
    args = parser.parse_args(argv)

    if args.demo == bool(args.input):
        parser.error("pass exactly one of --input or --demo")

    try:
        if args.demo:
            tensors = demo_tensors()
            model_id = args.name or "tiny-mlp"
        else:
            tensors = _load_state_dict(args.input, args.allow_unsafe_pickle)
            model_id = args.name or args.input.stem
        weights, document = convert(tensors, model_id, args.out_dir)
    except BridgeError as error:
        sys.stderr.write(f"error: {error}\n")
        return 2

    sys.stderr.write(f"wrote {weights}\nwrote {document}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
