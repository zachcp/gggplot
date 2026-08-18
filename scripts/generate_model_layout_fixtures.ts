/** Generate small ONNX topology fixtures used by the interactive scene picker. */

const encoder = new TextEncoder();

function varint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value;
  do {
    const next = remaining & 0x7f;
    remaining = Math.floor(remaining / 128);
    bytes.push(remaining ? next | 0x80 : next);
  } while (remaining);
  return bytes;
}

function join(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function field(number: number, value: Uint8Array): Uint8Array {
  return new Uint8Array([
    ...varint((number << 3) | 2),
    ...varint(value.length),
    ...value,
  ]);
}

function integer(number: number, value: number): Uint8Array {
  return new Uint8Array([...varint(number << 3), ...varint(value)]);
}

function text(number: number, value: string): Uint8Array {
  return field(number, encoder.encode(value));
}

function tensorType(shape: number[]): Uint8Array {
  return join(
    integer(1, 1), // TensorProto.FLOAT
    field(
      2,
      join(...shape.map((dimension) => field(1, integer(1, dimension)))),
    ),
  );
}

function value(name: string, shape: number[]): Uint8Array {
  return join(text(1, name), field(2, field(1, tensorType(shape))));
}

function initializer(name: string, shape: number[]): Uint8Array {
  const values = shape.reduce((product, dimension) => product * dimension, 1);
  return join(
    ...shape.map((dimension) => integer(1, dimension)),
    integer(2, 1), // TensorProto.FLOAT
    text(8, name),
    field(9, new Uint8Array(values * 4)),
  );
}

function node(
  name: string,
  op: string,
  inputs: string[],
  outputs: string[],
): Uint8Array {
  return join(
    ...inputs.map((input) => text(1, input)),
    ...outputs.map((output) => text(2, output)),
    text(3, name),
    text(4, op),
  );
}

interface GraphFixture {
  file: string;
  name: string;
  input: [string, number[]];
  output: [string, number[]];
  values: Array<[string, number[]]>;
  initializers: Array<[string, number[]]>;
  nodes: Array<[string, string, string[], string[]]>;
}

function model(fixture: GraphFixture): Uint8Array {
  const graph = join(
    ...fixture.nodes.map(([name, op, inputs, outputs]) =>
      field(1, node(name, op, inputs, outputs))
    ),
    text(2, fixture.name),
    ...fixture.initializers.map(([name, shape]) =>
      field(5, initializer(name, shape))
    ),
    field(11, value(...fixture.input)),
    field(12, value(...fixture.output)),
    ...fixture.values.map(([name, shape]) => field(13, value(name, shape))),
  );
  return join(field(7, graph), field(8, integer(2, 13)));
}

const fixtures: GraphFixture[] = [
  {
    file: "dense-chain.onnx",
    name: "Dense encoder chain",
    input: ["features", [1, 16]],
    output: ["logits", [1, 6]],
    values: [["encoded", [1, 12]], ["activated", [1, 12]]],
    initializers: [
      ["encoder.weight", [16, 12]],
      ["encoder.bias", [12]],
      ["classifier.weight", [12, 6]],
      ["classifier.bias", [6]],
    ],
    nodes: [
      ["encode", "Gemm", ["features", "encoder.weight", "encoder.bias"], [
        "encoded",
      ]],
      ["relu", "Relu", ["encoded"], ["activated"]],
      ["classify", "Gemm", [
        "activated",
        "classifier.weight",
        "classifier.bias",
      ], ["logits"]],
    ],
  },
  {
    file: "residual-merge.onnx",
    name: "Residual merge block",
    input: ["tokens", [1, 16]],
    output: ["scores", [1, 8]],
    values: [
      ["main.path", [1, 16]],
      ["skip.path", [1, 16]],
      ["merged", [1, 16]],
      ["activated", [1, 16]],
    ],
    initializers: [
      ["main.weight", [16, 16]],
      ["main.bias", [16]],
      ["skip.weight", [16, 16]],
      ["skip.bias", [16]],
      ["head.weight", [16, 8]],
      ["head.bias", [8]],
    ],
    nodes: [
      ["main projection", "Gemm", ["tokens", "main.weight", "main.bias"], [
        "main.path",
      ]],
      ["skip projection", "Gemm", ["tokens", "skip.weight", "skip.bias"], [
        "skip.path",
      ]],
      ["residual add", "Add", ["main.path", "skip.path"], ["merged"]],
      ["relu", "Relu", ["merged"], ["activated"]],
      ["head", "Gemm", ["activated", "head.weight", "head.bias"], ["scores"]],
    ],
  },
  {
    file: "multi-head.onnx",
    name: "Multi-head fan-out",
    input: ["embedding", [1, 24]],
    output: ["distribution", [1, 12]],
    values: [
      ["stem", [1, 16]],
      ["activated", [1, 16]],
      ["head.alpha", [1, 4]],
      ["head.beta", [1, 4]],
      ["head.gamma", [1, 4]],
      ["joined", [1, 12]],
    ],
    initializers: [
      ["stem.weight", [24, 16]],
      ["stem.bias", [16]],
      ["alpha.weight", [16, 4]],
      ["alpha.bias", [4]],
      ["beta.weight", [16, 4]],
      ["beta.bias", [4]],
      ["gamma.weight", [16, 4]],
      ["gamma.bias", [4]],
    ],
    nodes: [
      ["stem projection", "Gemm", ["embedding", "stem.weight", "stem.bias"], [
        "stem",
      ]],
      ["relu", "Relu", ["stem"], ["activated"]],
      ["alpha head", "Gemm", ["activated", "alpha.weight", "alpha.bias"], [
        "head.alpha",
      ]],
      ["beta head", "Gemm", ["activated", "beta.weight", "beta.bias"], [
        "head.beta",
      ]],
      ["gamma head", "Gemm", ["activated", "gamma.weight", "gamma.bias"], [
        "head.gamma",
      ]],
      ["join heads", "Concat", ["head.alpha", "head.beta", "head.gamma"], [
        "joined",
      ]],
      ["normalize", "Softmax", ["joined"], ["distribution"]],
    ],
  },
  transformerStackFixture(),
];

function transformerStackFixture(): GraphFixture {
  const initializers: Array<[string, number[]]> = [];
  const values: Array<[string, number[]]> = [];
  const nodes: Array<[string, string, string[], string[]]> = [];
  let signal = "embedding";
  const linear = (
    block: number,
    name: string,
    input: string,
    output: string,
    widthIn: number,
    widthOut: number,
  ) => {
    const prefix = `block${block}.${name}`;
    initializers.push([`${prefix}.weight`, [widthIn, widthOut]]);
    initializers.push([`${prefix}.bias`, [widthOut]]);
    nodes.push([
      `block ${block} ${name}`,
      "Gemm",
      [input, `${prefix}.weight`, `${prefix}.bias`],
      [output],
    ]);
    values.push([output, [1, widthOut]]);
  };

  for (let block = 1; block <= 2; block++) {
    const prefix = `block${block}`;
    const query = `${prefix}.query`;
    const key = `${prefix}.key`;
    const valueVector = `${prefix}.value`;
    const scores = `${prefix}.scores`;
    const attended = `${prefix}.attended`;
    const projected = `${prefix}.projected`;
    const attentionResidual = `${prefix}.attention_residual`;
    const normalized = `${prefix}.normalized`;
    const expanded = `${prefix}.expanded`;
    const activated = `${prefix}.activated`;
    const contracted = `${prefix}.contracted`;
    const output = `${prefix}.output`;

    linear(block, "query projection", signal, query, 32, 32);
    linear(block, "key projection", signal, key, 32, 32);
    linear(block, "value projection", signal, valueVector, 32, 32);
    nodes.push([
      `block ${block} attention scores`,
      "MatMul",
      [query, key],
      [scores],
    ]);
    values.push([scores, [1, 32]]);
    nodes.push([
      `block ${block} attention values`,
      "MatMul",
      [scores, valueVector],
      [attended],
    ]);
    values.push([attended, [1, 32]]);
    linear(block, "attention projection", attended, projected, 32, 32);
    nodes.push([
      `block ${block} attention residual`,
      "Add",
      [signal, projected],
      [attentionResidual],
    ]);
    values.push([attentionResidual, [1, 32]]);
    nodes.push([
      `block ${block} normalize`,
      "Identity",
      [attentionResidual],
      [normalized],
    ]);
    values.push([normalized, [1, 32]]);
    linear(block, "feed-forward expand", normalized, expanded, 32, 64);
    nodes.push([
      `block ${block} activation`,
      "Relu",
      [expanded],
      [activated],
    ]);
    values.push([activated, [1, 64]]);
    linear(block, "feed-forward contract", activated, contracted, 64, 32);
    nodes.push([
      `block ${block} feed-forward residual`,
      "Add",
      [normalized, contracted],
      [output],
    ]);
    values.push([output, [1, 32]]);
    signal = output;
  }

  return {
    file: "tiny-encoder-stack.onnx",
    name: "Tiny encoder stack",
    input: ["embedding", [1, 32]],
    output: [signal, [1, 32]],
    values,
    initializers,
    nodes,
  };
}

const target = new URL("../apps/site/public/models/", import.meta.url);
for (const fixture of fixtures) {
  await Deno.writeFile(new URL(fixture.file, target), model(fixture));
}
