import { assertEquals } from "jsr:@std/assert@1";
import { geomLine, geomPoint, ggplot } from "../src/dsl/mod.ts";
import { compile } from "../src/compile/mod.ts";
import { emitSource } from "../src/emit/mod.ts";
import { depthProps } from "../src/geom/shared.ts";
import { GEOM_REGISTRY } from "../src/geom/mod.ts";
import type { RenderNode } from "../src/compile/rendertree.ts";

const data = { x: [0, 1], y: [1, 2], z: [3, 4] };

function findNodes(node: RenderNode, component: string): RenderNode[] {
  return [
    ...(node.component === component ? [node] : []),
    ...(node.children ?? []).flatMap((child) => findNodes(child, component)),
  ];
}

Deno.test("depth policies resolve to buffer props", () => {
  // Opaque ignores observed alpha: a declared always-writes geom must not have
  // occlusion silently disabled by a translucent tint.
  assertEquals(depthProps("opaque", false), {
    depthTest: true,
    depthWrite: true,
  });
  assertEquals(depthProps("opaque", true), {
    depthTest: true,
    depthWrite: true,
  });
  // alphaAware follows the data.
  assertEquals(depthProps("alphaAware", false), {
    depthTest: true,
    depthWrite: true,
  });
  assertEquals(depthProps("alphaAware", true), {
    depthTest: true,
    depthWrite: false,
    mode: "transparent",
  });
  assertEquals(depthProps("overlay", false), {
    depthTest: false,
    depthWrite: false,
    mode: "transparent",
  });
  // Omitting the policy means alphaAware, not "ask the renderer": a geom that
  // forgets to declare still gets correct blending.
  assertEquals(depthProps(undefined, true), {
    depthTest: true,
    depthWrite: false,
    mode: "transparent",
  });
});

Deno.test("every 3D mode declares a depth policy", () => {
  for (const [kind, definition] of Object.entries(GEOM_REGISTRY)) {
    for (const mode of definition.modes ?? []) {
      if (mode.dimensions !== 3) continue;
      assertEquals(
        typeof mode.depth,
        "string",
        `geom_${kind} has a 3D mode with no declared depth policy`,
      );
    }
  }
});

Deno.test("point and line depth behaviour is unchanged by the refactor", () => {
  for (
    const [alpha, expected] of [
      [1, { depthTest: true, depthWrite: true, mode: undefined }],
      [0.5, { depthTest: true, depthWrite: false, mode: "transparent" }],
    ] as const
  ) {
    const point = findNodes(
      compile(
        ggplot(data, { x: "x", y: "y", z: "z" }).add(geomPoint({ alpha }))
          .build(),
      ),
      "Point",
    )[0];
    assertEquals(point.props.depthTest, expected.depthTest);
    assertEquals(point.props.depthWrite, expected.depthWrite);
    assertEquals(point.props.mode, expected.mode);

    const line = findNodes(
      compile(
        ggplot(data, { x: "x", y: "y", z: "z" }).add(geomLine({ alpha }))
          .build(),
      ),
      "ChunkedLine",
    )[0];
    assertEquals(line.props.depthTest, expected.depthTest);
    assertEquals(line.props.depthWrite, expected.depthWrite);
    assertEquals(line.props.mode, expected.mode);
  }
});

Deno.test("the resolved policy survives emitSource", () => {
  const opaque = emitSource(
    compile(
      ggplot(data, { x: "x", y: "y", z: "z" }).add(geomPoint()).build(),
    ),
    "Opaque3D",
  );
  assertEquals(opaque.includes("depthWrite={true}"), true);
  assertEquals(opaque.includes('mode="transparent"'), false);

  const translucent = emitSource(
    compile(
      ggplot(data, { x: "x", y: "y", z: "z" }).add(geomPoint({ alpha: 0.4 }))
        .build(),
    ),
    "Translucent3D",
  );
  assertEquals(translucent.includes("depthWrite={false}"), true);
  assertEquals(translucent.includes('mode="transparent"'), true);
});

Deno.test("an explicit depthTest param still overrides the policy", () => {
  const point = findNodes(
    compile(
      ggplot(data, { x: "x", y: "y", z: "z" }).add(
        geomPoint({ depthTest: false }),
      ).build(),
    ),
    "Point",
  )[0];
  assertEquals(point.props.depthTest, false);
  // The override touches testing only; writing still follows the policy.
  assertEquals(point.props.depthWrite, true);
});
