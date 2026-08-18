# gggplot PyTorch bridge

A trusted, host-side converter from PyTorch artifacts into portable files the
model inspector can read **without executing anything**.

Nothing here runs in a browser. That is the point: reading a PyTorch artifact
means unpickling, unpickling means executing code from the file, and that step
belongs on your machine, deliberately, never against a file a user supplied.

## Trust boundary

> **Loading a pickled PyTorch artifact executes code from that file.** Only do
> this for models you produced or otherwise trust completely.

The bridge defends that boundary in three ways:

- `torch.load(..., weights_only=True)` is the default, which refuses to
  unpickle arbitrary objects and reads tensors only.
- Full unpickling requires `--allow-unsafe-pickle` and prints a warning to
  stderr before it proceeds.
- The browser side never sees a `.pt` at all — only SafeTensors and JSON.

## Format decision

**The bridge accepts a `state_dict` and emits SafeTensors plus a model
document.** It does not define a new interchange format, because the inspector
already parses two portable ones.

| Input | Accepted | Notes |
| --- | --- | --- |
| `.pt` / `.pth` / `.bin` / `.ckpt` holding a `state_dict` | yes | Read with `weights_only=True` |
| A full pickled `nn.Module` or TorchScript archive | only with `--allow-unsafe-pickle` | Weights are converted; the graph is not |
| PT2 `ExportedProgram` | no | Use `torch.onnx.export` instead |
| `.safetensors` | not needed | Already portable; inspect it directly |

| Output | Contents |
| --- | --- |
| `<name>.safetensors` | Weights, row-major, offsets relative to the payload |
| `<name>.model.json` | A `gggplot.model@1` document: descriptors and byte ranges, never payloads |

### A state_dict has no graph

This is the honest limitation of the whole approach. A `state_dict` is a
mapping of names to weights; it records nothing about how those weights were
wired together. The emitted document therefore contains **no nodes and no
edges**, and says so explicitly:

```json
"metadata": {
  "graphStructure": "none",
  "graphStructureReason": "a state_dict records weights, not topology; export to ONNX when graph structure is required"
}
```

A consumer must be able to tell "this model has no topology" from "we failed to
read the topology". Stating the absence is what makes that possible.

**When you need graph structure, export to ONNX** (`torch.onnx.export`) and
inspect that directly — the package parses ONNX statically, with the full
operator graph and no runtime.

## Usage

Emit the bundled fixture. Requires no PyTorch and no third-party packages:

```bash
python3 -m gggplot_bridge.cli --demo --out-dir ./out
```

Convert a real state_dict:

```bash
python3 -m gggplot_bridge.cli --input weights.pt --name my-model --out-dir ./out
```

| Flag | Meaning |
| --- | --- |
| `--input PATH` | A `.pt`/`.pth` state_dict to convert |
| `--demo` | Emit the deterministic tiny-MLP fixture instead |
| `--name ID` | Model id for the outputs; defaults to the input stem |
| `--out-dir DIR` | Destination directory |
| `--allow-unsafe-pickle` | Permit full unpickling, which **executes code** |

Exit code `2` means a refusal or a malformed input, reported as a message
rather than a traceback.

## API

```python
from gggplot_bridge import Tensor, write_safetensors, build_model_document

payload = write_safetensors([Tensor("w", "F32", (2, 2), (1.0, 2.0, 3.0, 4.0))])
document = build_model_document("m", tensors, "file:m.safetensors", "m.safetensors", len(payload))
```

`tensors_from_state_dict()` converts a torch `state_dict`; `torch` is imported
by the caller, so every other entry point stays importable without it.

## Tests

```bash
cd tools/pytorch_bridge && python3 -m unittest discover -s tests
```

The fixture in `packages/model-inspect/tests/fixtures/` is produced by `--demo`
and read back by `bridge_fixture_test.ts`, so the Python writer and the
TypeScript reader are tested against each other. Regenerate it with:

```bash
cd tools/pytorch_bridge && python3 -m gggplot_bridge.cli --demo --out-dir ../../packages/model-inspect/tests/fixtures
```

The writer is deterministic, so an unchanged model produces byte-identical
output and the committed fixture stays diffable.
