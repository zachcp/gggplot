// Gate for gggplot-jx6: the saved RenderTree fixtures under tests/fixtures/
// geom_registry/ only have value if something verifies them. scripts/
// capture_geom_fixtures.ts has had a --check mode all along, but nothing ran
// it, so 15 fixtures silently drifted out of date before anyone noticed
// (Grid nodes gained range/first/second/width/zBias props, among other
// things). This test puts that check inside `deno task test`, which CI
// already runs, so drift fails a build instead of waiting to be spotted.
//
// A failure here is NOT necessarily a bug: it means compiler output changed.
// Read the diff, decide whether the change was intended, and if it was,
// regenerate the baseline with `deno task fixtures:capture`.
//
// One step per fixture so a failure names the case that drifted rather than
// reporting a single opaque mismatch across the whole set.
import { assertEquals } from "@std/assert";
import {
  fixtureDir,
  renderFixtures,
} from "../../../scripts/capture_geom_fixtures.ts";

Deno.test("saved RenderTree fixtures match fresh compiler output", async (t) => {
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
        `RenderTree for "${name}" differs from its saved baseline. If the ` +
          `change was intended, regenerate with \`deno task fixtures:capture\`.`,
      );
    });
  }
});
