import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import {
  compileMarks,
  emitMarkSource,
  MARK_EXTENSION_ID,
  markDefinition,
  registerMarks,
} from "../src/mod.ts";

const data = {
  x: [0, 1, 0, 10, 11, 10],
  y: [0, 0, 1, 10, 10, 11],
  group: ["a", "a", "a", "b", "b", "b"],
};

Deno.test("mark extension emits deterministic grouped enclosure methods", () => {
  const registry = registerMarks();
  assertEquals(registry.resolve(MARK_EXTENSION_ID).definition, markDefinition);
  for (const method of ["hull", "ellipse", "rect", "circle"] as const) {
    const nodes = compileMarks({
      extension: MARK_EXTENSION_ID,
      data,
      params: { method, expand: 0.5, segments: 16 },
    }, registry);
    assertEquals(nodes.length, 2);
    assertEquals(nodes.map((node) => node.props.group), ["a", "b"]);
    assertEquals(
      nodes.every((node) =>
        node.props.positions.length >= (method === "hull" ? 3 : 4)
      ),
      true,
    );
    assertStringIncludes(emitMarkSource(nodes), "<Polygon");
  }
});

Deno.test("mark extension handles degenerate groups and validates contracts", () => {
  const registry = registerMarks();
  assertEquals(
    compileMarks({
      extension: MARK_EXTENSION_ID,
      data: { x: [1], y: [2] },
      params: { method: "circle", expand: 1, segments: 8 },
    }, registry)[0].props.positions.length,
    8,
  );
  assertThrows(
    () =>
      compileMarks({
        extension: MARK_EXTENSION_ID,
        data,
        params: { method: "blob" as never },
      }, registry),
    TypeError,
    "unsupported method",
  );
  assertThrows(
    () =>
      compileMarks(
        { extension: MARK_EXTENSION_ID, data: { x: [1], y: [] } },
        registry,
      ),
    TypeError,
    "align",
  );
});

Deno.test("mark extension compilation is panel-local", () => {
  const registry = registerMarks();
  const left = compileMarks({
    extension: MARK_EXTENSION_ID,
    data: { x: [0, 1, 0], y: [0, 0, 1], group: ["a", "a", "a"] },
  }, registry);
  const right = compileMarks({
    extension: MARK_EXTENSION_ID,
    data: { x: [10, 11, 10], y: [10, 10, 11], group: ["a", "a", "a"] },
  }, registry);
  assertEquals(Math.max(...left[0].props.positions.map(([x]) => x)) < 2, true);
  assertEquals(Math.min(...right[0].props.positions.map(([x]) => x)) > 9, true);
});
