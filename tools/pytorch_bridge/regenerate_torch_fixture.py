"""Regenerate packages/model-inspect/tests/fixtures/torch-real.* (gggplot-i5m.25).

Requires PyTorch, which is deliberately NOT a dependency of this repo: the
committed fixtures let CI verify the bridge's torch-reading half without it.
Run this only when the bridge's dtype mapping or document shape changes.

    uv venv .venv && .venv/bin/pip install torch
    .venv/bin/python tools/pytorch_bridge/regenerate_torch_fixture.py
    # then, from tools/pytorch_bridge/:
    #   python -m gggplot_bridge.cli --input state_dict.pt --name tinynet --out-dir out
    # and copy out/tinynet.safetensors + out/tinynet.model.json + truth.json
    # into packages/model-inspect/tests/fixtures/ as torch-real.*

The tensors are chosen to be awkward on purpose: every dtype the bridge maps,
plus a non-contiguous transposed view that only a value comparison can catch.
"""
import json, torch, torch.nn as nn

torch.manual_seed(7)

class TinyNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(4, 3)
        self.fc2 = nn.Linear(3, 2)

net = TinyNet()
sd = dict(net.state_dict())

# Non-contiguous on purpose: a transposed view. If the bridge dropped
# .contiguous(), flatten() would still work but the VALUE ORDER would be the
# pre-transpose order, silently mismatching the declared shape.
base = torch.arange(12, dtype=torch.float32).reshape(3, 4)
sd["probe.transposed"] = base.t()

sd["probe.f64"] = torch.tensor([[1.5, -2.25], [3.125, 4.0]], dtype=torch.float64)
sd["probe.i64"] = torch.tensor([[-1, 2], [3, -4]], dtype=torch.int64)
sd["probe.i32"] = torch.tensor([7, -8, 9], dtype=torch.int32)
sd["probe.i16"] = torch.tensor([100, -200], dtype=torch.int16)
sd["probe.i8"]  = torch.tensor([-5, 6], dtype=torch.int8)
sd["probe.u8"]  = torch.tensor([250, 3], dtype=torch.uint8)

print("non-contiguous check:", sd["probe.transposed"].is_contiguous())
torch.save(sd, "state_dict.pt")

# Ground truth straight from torch, for comparison against what the TS reader sees.
truth = {
    name: {
        "dtype": str(t.dtype).removeprefix("torch."),
        "shape": list(t.shape),
        "values": t.detach().to("cpu").contiguous().flatten().tolist(),
    }
    for name, t in sd.items()
}
json.dump(truth, open("truth.json", "w"), indent=2)
print("tensors:", len(truth))
