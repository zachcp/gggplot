/** Local ONNX artifacts chosen to exercise distinct 3D model-layout classes. */
export interface ModelFixture {
  id: string;
  path: string;
  label: string;
  topology: string;
  description: string;
}

export const MODEL_FIXTURES: readonly ModelFixture[] = [
  {
    id: "mnist",
    path: "/models/mnist-12.onnx",
    label: "MNIST classifier",
    topology: "convolutional chain",
    description:
      "Bundled ONNX Model Zoo classifier with repeated convolution and dense stages.",
  },
  {
    id: "dense-chain",
    path: "/models/dense-chain.onnx",
    label: "Dense encoder chain",
    topology: "sequential MLP",
    description:
      "A compact linear chain that makes layer spacing and parameter slabs easy to inspect.",
  },
  {
    id: "residual-merge",
    path: "/models/residual-merge.onnx",
    label: "Residual merge block",
    topology: "parallel branch + merge",
    description:
      "Two projections diverge from one input, rejoin at an Add, then pass to a head.",
  },
  {
    id: "multi-head",
    path: "/models/multi-head.onnx",
    label: "Multi-head fan-out",
    topology: "fan-out / fan-in",
    description:
      "One shared stem feeds three heads that concatenate before the final normalization.",
  },
  {
    id: "tiny-encoder-stack",
    path: "/models/tiny-encoder-stack.onnx",
    label: "Tiny encoder stack",
    topology: "two-block transformer-style encoder",
    description:
      "Two repeated attention-like fan-out, residual, and feed-forward blocks for a denser navigable scene.",
  },
];

export const DEFAULT_MODEL_FIXTURE = MODEL_FIXTURES[0];

export function fixtureById(id: string): ModelFixture {
  return MODEL_FIXTURES.find((fixture) => fixture.id === id) ??
    DEFAULT_MODEL_FIXTURE;
}
