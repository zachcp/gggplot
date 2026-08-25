import { assert, assertEquals } from "@std/assert";
import {
  buildModelScene3D,
  type ModelDocument,
  pickSceneEntity,
} from "../src/mod.ts";

/** The same three-node fixture scene3d_test.ts builds its assertions on. */
const document: ModelDocument = {
  schema: "gggplot.model@1",
  id: "picking-fixture",
  source: { id: "fixture.onnx", format: "onnx", kind: "memory" },
  graphs: [{
    id: "main",
    inputs: [{ id: "input", tensorId: "input", dtype: "f32", shape: [1, 4] }],
    outputs: [{ id: "output", tensorId: "output", dtype: "f32", shape: [1, 2] }],
    nodes: [
      { id: "in", kind: "input", inputs: [], outputs: [{ id: "input", tensorId: "input" }] },
      {
        id: "linear",
        kind: "operator",
        op: "Gemm",
        inputs: [{ id: "input", tensorId: "input" }, { id: "weight", tensorId: "weight" }],
        outputs: [{ id: "hidden", tensorId: "hidden" }],
        parameters: ["weight"],
      },
      { id: "out", kind: "output", inputs: [{ id: "hidden", tensorId: "hidden" }], outputs: [] },
    ],
    edges: [
      { id: "input", from: "in", to: "linear", valueId: "input", tensorId: "input" },
      { id: "output", from: "linear", to: "out", valueId: "hidden", tensorId: "hidden" },
    ],
  }],
  tensors: {
    input: { id: "input", dtype: "f32", shape: [1, 4], role: "input" },
    hidden: { id: "hidden", dtype: "f32", shape: [1, 2], role: "activation" },
    output: { id: "output", dtype: "f32", shape: [1, 2], role: "output" },
    weight: { id: "weight", dtype: "f32", shape: [32, 16], role: "parameter" },
  },
};

const scene = buildModelScene3D(document, { maxTileRows: 8, maxTileColumns: 12 });

/**
 * A ray aimed at a box centre, starting just outside its near face.
 *
 * Starting far away would be wrong: the scene stacks slabs along x, so a ray
 * from x = -1000 passes through every slab sharing that (y, z) and the NEAREST
 * one wins — not necessarily the one under test. Originating just ahead of the
 * target puts everything else either behind the origin (a miss) or farther
 * along the ray.
 */
function rayAt(
  center: readonly [number, number, number],
  size: readonly [number, number, number],
) {
  const origin: [number, number, number] = [
    center[0] - Math.abs(size[0]) / 2 - 1e-3,
    center[1],
    center[2],
  ];
  return { origin, direction: [1, 0, 0] as [number, number, number] };
}

Deno.test("a ray through a slab centre picks that slab", () => {
  for (const slab of scene.slabs) {
    const { origin, direction } = rayAt(slab.center, slab.size);
    const hit = pickSceneEntity(scene, origin, direction);
    assert(hit, `expected a hit for slab ${slab.id}`);
    assertEquals(hit.kind, "slab");
    assertEquals(hit.id, slab.id);
  }
});

Deno.test("a picked slab reports the tensor id the inventory keys off", () => {
  const slab = scene.slabs.find((s) => s.tensorId != null);
  assert(slab, "fixture must have at least one tensor-backed slab");
  const { origin, direction } = rayAt(slab.center, slab.size);
  const hit = pickSceneEntity(scene, origin, direction);
  assertEquals(hit?.tensorId, slab.tensorId);
});

Deno.test("a slab outranks the module enclosing it", () => {
  // The regression this guards: a slab sits INSIDE its module box, so the
  // module is always entered first and nearest-distance alone would return the
  // module for every ray, making slabs unpickable.
  const slab = scene.slabs.find((s) => s.moduleId != null);
  assert(slab, "fixture must have a slab inside a module");
  const { origin, direction } = rayAt(slab.center, slab.size);
  const hit = pickSceneEntity(scene, origin, direction);
  assertEquals(hit?.kind, "slab");
  assertEquals(hit?.id, slab.id);
});

Deno.test("a ray through a module but no slab still picks the module", () => {
  // Pick a module that has room above its slabs, and aim into that gap.
  const candidates = scene.modules.map((module) => {
    const inner = scene.slabs.filter((s) => s.moduleId === module.id);
    const slabTop = inner.length
      ? Math.max(...inner.map((s) => s.center[1] + Math.abs(s.size[1]) / 2))
      : module.center[1] - Math.abs(module.size[1]) / 2;
    const moduleTop = module.center[1] + Math.abs(module.size[1]) / 2;
    return { module, slabTop, moduleTop };
  }).filter((c) => c.moduleTop - c.slabTop > 1e-6);
  assert(candidates.length, "fixture must have a module with space above its slabs");
  const { module, slabTop, moduleTop } = candidates[0];
  const y = (moduleTop + slabTop) / 2;
  const hit = pickSceneEntity(
    scene,
    [module.center[0] - Math.abs(module.size[0]) / 2 - 1e-3, y, module.center[2]],
    [1, 0, 0],
  );
  // Strengthen the case: this ray must ALSO reach a slab further along, in a
  // different module. That is precisely the configuration a blanket
  // "slabs beat modules" rule got wrong — it returned the distant slab instead
  // of the module the pointer was over. Without this assertion the test could
  // silently degenerate into "nothing else was in the way".
  const slabAhead = scene.slabs.some((s) =>
    s.moduleId !== module.id &&
    s.center[0] - Math.abs(s.size[0]) / 2 > module.center[0] &&
    Math.abs(s.center[1] - y) <= Math.abs(s.size[1]) / 2 &&
    Math.abs(s.center[2] - module.center[2]) <= Math.abs(s.size[2]) / 2
  );
  assert(slabAhead, "expected a slab further along the ray in another module");

  assertEquals(hit?.kind, "module");
  assertEquals(hit?.id, module.id);
});

Deno.test("a ray pointing away from the scene picks nothing", () => {
  const slab = scene.slabs[0];
  const hit = pickSceneEntity(
    scene,
    [slab.center[0] - Math.abs(slab.size[0]) / 2 - 1e-3, slab.center[1], slab.center[2]],
    [-1, 0, 0],
  );
  assertEquals(hit, null);
});

Deno.test("a ray that misses every box picks nothing", () => {
  const far = scene.bounds.max[1] + 1000;
  const hit = pickSceneEntity(scene, [-1000, far, 0], [1, 0, 0]);
  assertEquals(hit, null);
});

Deno.test("a ray parallel to an axis does not produce a NaN hit", () => {
  // 1/0 is Infinity by design in the slab test; this pins that a degenerate
  // direction reports a miss rather than a NaN that compares its way to a hit.
  const slab = scene.slabs[0];
  const hit = pickSceneEntity(
    scene,
    [slab.center[0], slab.center[1], slab.center[2] - 1000],
    [0, 0, 0],
  );
  assertEquals(hit, null);
});

Deno.test("every picked id is a real scene entity id", () => {
  const known = new Set(scene.entities.map((entity) => entity.id));
  for (const slab of scene.slabs) {
    const { origin, direction } = rayAt(slab.center, slab.size);
    const hit = pickSceneEntity(scene, origin, direction);
    assert(hit && known.has(hit.id), `${hit?.id} is not a scene entity id`);
  }
});
