// Gate for gggplot-jx6: the saved mark fixtures under tests/fixtures/
// geom_registry/ only have value if something verifies them. scripts/
// capture_geom_fixtures.ts has had a --check mode all along, but nothing ran
// it, so 15 fixtures silently drifted out of date before anyone noticed
// (Grid nodes gained range/first/second/width/zBias props, among other
// things). This test puts that check inside `deno task test`, which CI
// already runs, so drift fails a build instead of waiting to be spotted.
//
// Since gggplot-dh8a each fixture is a case's per-layer lowered marks
// (component, tensors, owners) as the component root assembles them, so the
// gate outlives compile() and the RenderTree.
//
// A failure here is NOT necessarily a bug: it means lowered output changed.
// Read the diff, decide whether the change was intended, and if it was,
// regenerate the baseline with `deno task fixtures:capture`.
//
// One step per fixture so a failure names the case that drifted rather than
// reporting a single opaque mismatch across the whole set.
import { assert, assertEquals } from "@std/assert";
import {
  fixtureDir,
  renderFixtures,
} from "../../../scripts/capture_geom_fixtures.ts";
import { GEOM_REGISTRY } from "../src/geom/mod.ts";
import type { FlatTensor, RenderNode } from "../src/compile/rendertree.ts";

Deno.test("saved mark fixtures match freshly lowered marks", async (t) => {
  const rendered = renderFixtures();

  // A fixture that stops being rendered would otherwise leave its stale file
  // on disk unchecked, and a new case with no baseline would be a missing
  // file rather than a mismatch. Compare the sets first so both show up.
  const savedNames = new Set<string>();
  for await (const entry of Deno.readDir(fixtureDir)) {
    if (entry.isFile && entry.name.endsWith(".json")) {
      savedNames.add(entry.name.slice(0, -".json".length));
    }
  }
  assertEquals(
    [...savedNames].sort(),
    rendered.map(({ name }) => name).sort(),
    "saved fixture files and rendered cases disagree; run `deno task fixtures:capture`",
  );

  for (const { name, json } of rendered) {
    await t.step(name, async () => {
      const saved = await Deno.readTextFile(
        new URL(`${name}.json`, fixtureDir),
      );
      assertEquals(
        json,
        saved,
        `Lowered marks for "${name}" differ from the saved baseline. If the ` +
          `change was intended, regenerate with \`deno task fixtures:capture\`.`,
      );
    });
  }
});

Deno.test("the gate catches an injected lowering drift", () => {
  // The negative control: nudge one coordinate of every line geom's lowered
  // positions and the saved baselines must stop matching.
  const line = GEOM_REGISTRY.line;
  const lower = line.lower;
  line.lower = (...args: Parameters<typeof lower>) =>
    lower(...args).map((node: RenderNode) => {
      const positions = node.props.positions as FlatTensor | undefined;
      if (!positions || !ArrayBuffer.isView(positions.array)) return node;
      const array = Float32Array.from(positions.array as Float32Array);
      array[0] += 1;
      return {
        ...node,
        props: { ...node.props, positions: { ...positions, array } },
      };
    });
  try {
    const drifted = renderFixtures().filter(({ name, json }) =>
      json !== Deno.readTextFileSync(new URL(`${name}.json`, fixtureDir))
    ).map(({ name }) => name);
    assert(drifted.length > 0, "an injected drift went unnoticed");
    // Only the cases that draw a line.
    assertEquals(drifted, ["line_step_area"]);
  } finally {
    line.lower = lower;
  }
  // And restored, the baselines match again.
  const after = renderFixtures().filter(({ name, json }) =>
    json !== Deno.readTextFileSync(new URL(`${name}.json`, fixtureDir))
  );
  assertEquals(after.length, 0);
});
