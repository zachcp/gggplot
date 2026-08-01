import {
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "jsr:@std/assert@1";
import { geomLine, geomPath, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { emitSource } from "../src/emit/mod.ts";
import type { FlatTensor, RenderNode } from "../src/compile/rendertree.ts";

const data = {
  x: [2, 0, 1, 2, 0, 1],
  y: [12, 10, 11, 22, 20, 21],
  z: [120, 100, 110, 220, 200, 210],
  group: ["a", "a", "a", "b", "b", "b"],
};

function lineNode(geom: ReturnType<typeof geomLine>): RenderNode {
  const tree = compile(
    ggplot(data, { x: "x", y: "y", z: "z", group: "group" }).add(geom)
      .build(),
  );
  return tree.children[0].children[0].children.find((node) =>
    node.component === "ChunkedLine"
  )!;
}

function tuples(tensor: FlatTensor): number[][] {
  const output: number[][] = [];
  for (let row = 0; row < tensor.length; row++) {
    output.push(
      Array.from(
        tensor.array.slice(row * tensor.dims, (row + 1) * tensor.dims),
      ),
    );
  }
  return output;
}

Deno.test("geomLine z mode sorts within groups and packs disjoint vec4 chunks", () => {
  const line = lineNode(geomLine());
  const positions = line.props.positions as FlatTensor;
  assertEquals(positions.dims, 4);
  assertEquals(tuples(positions), [
    [0, 10, 100, 1],
    [1, 11, 110, 1],
    [2, 12, 120, 1],
    [0, 20, 200, 1],
    [1, 21, 210, 1],
    [2, 22, 220, 1],
  ]);
  assertEquals(
    Array.from((line.props.topology as { chunks: Uint32Array }).chunks),
    [3, 3],
  );
  assertEquals(line.props.depthTest, true);
  assertEquals(line.props.depthWrite, true);
});

Deno.test("geomPath z mode preserves input order and validates mode limits", () => {
  const path = lineNode(geomPath());
  assertEquals(tuples(path.props.positions as FlatTensor).slice(0, 3), [
    [2, 12, 120, 1],
    [0, 10, 100, 1],
    [1, 11, 110, 1],
  ]);
  assertThrows(
    () =>
      compile(
        ggplot(data, { x: "x", y: "y", z: "z" }).add(
          geomLine({ stat: "smooth" }),
        ).build(),
      ),
    Error,
    'does not support stat "smooth"',
  );
  assertThrows(
    () =>
      compile(
        ggplot(data, { x: "x", y: "y", z: "z" }).add(
          geomPath({ position: "jitter" }),
        ).build(),
      ),
    Error,
    'does not support position "jitter"',
  );
});

Deno.test("emitted 3D polylines keep vec4 tensors and the shared Scene3D", async () => {
  const tree = compile(
    ggplot(data, { x: "x", y: "y", z: "z", group: "group" }).add(
      geomLine({ alpha: 0.5, linetype: "dashed" }),
    ).build(),
  );
  const source = emitSource(tree, "Line3D");
  assertStringIncludes(source, "<Scene3D");
  assertStringIncludes(source, "<ChunkedLine");
  assertStringIncludes(source, 'format: "vec4"');
  assertStringIncludes(source, 'mode="transparent"');
  assertStringIncludes(source, "depthWrite={false}");

  const packageDir = new URL("../", import.meta.url).pathname;
  const output = await Deno.makeTempFile({
    dir: packageDir,
    prefix: "gen_line_3d_",
    suffix: ".tsx",
  });
  try {
    await Deno.writeTextFile(output, source);
    const result = await new Deno.Command("deno", {
      args: ["check", output],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(result.code, 0, new TextDecoder().decode(result.stderr));
  } finally {
    await Deno.remove(output);
  }
});
