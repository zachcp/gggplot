// gggplot-vnh.11: `gggplot print` writes a component tree as the JSX a user
// would write, data by reference. The printed module must type-check, run,
// and build the same tree (printing it again gives the same source).
import { assert, assertEquals, assertRejects } from "@std/assert";
import { runCli } from "../src/cli.ts";
import { printJsx } from "../src/emit/jsx.ts";
import type { LiveElement } from "@use-gpu/live";

const FIXTURE = new URL("./fixtures/demo_chart.tsx", import.meta.url).pathname;
const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;

const EXPECTED = `<GGPlot data={cars} mapping={{ x: "wt" }}>
    <GeomLine mapping={{ y: "mpg" }} color="#3b82f6" />
    <GeomLine mapping={{ y: "hp" }} color="#ef4444" />
    <GeomPoint mapping={{ y: "mpg" }} size={6} />
    <Labs title="Weight against mpg and hp" />
  </GGPlot>`;

Deno.test("gggplot print writes the tree as JSX that type-checks and rebuilds it", async () => {
  // Inside the package, so the printed imports resolve as a user's would.
  const outPath = `${FIXTURES}printed_chart.tsx`;
  try {
    assertEquals(await runCli(["print", FIXTURE, outPath]), outPath);
    const src = await Deno.readTextFile(outPath);
    assert(src.includes(EXPECTED), src);
    assert(src.includes('import { cars } from "./demo_chart.tsx";'), src);
    assert(
      src.includes(
        'import { GeomLine, GeomPoint, GGPlot, Labs } from "@gggplot/core";',
      ),
      src,
    );
    assert(src.includes("export const PrintedChart = (): LiveElement =>"));

    const check = await new Deno.Command(Deno.execPath(), {
      args: ["check", outPath],
      stderr: "piped",
    }).output();
    assertEquals(check.code, 0, new TextDecoder().decode(check.stderr));

    const printed = await import(`file://${outPath}`);
    const fixture = await import(`file://${FIXTURE}`);
    const refs = new Map([[fixture.cars, "cars"]]);
    assertEquals(
      printJsx(printed.PrintedChart() as LiveElement, { refs }).source,
      printJsx(fixture.chart() as LiveElement, { refs }).source,
    );
  } finally {
    await Deno.remove(outPath).catch(() => {});
  }
});

Deno.test("gggplot print names the component from the output filename, or --name", async () => {
  const outPath = `${FIXTURES}scatter_chart.tsx`;
  try {
    await runCli(["print", FIXTURE, outPath]);
    assert(
      (await Deno.readTextFile(outPath)).includes("export const ScatterChart"),
    );
    await runCli(["print", FIXTURE, outPath, "--name=MyChart"]);
    assert((await Deno.readTextFile(outPath)).includes("export const MyChart"));
  } finally {
    await Deno.remove(outPath).catch(() => {});
  }
});

Deno.test("gggplot print refuses to inline data the module does not export", async () => {
  const dir = await Deno.makeTempDir({ dir: FIXTURES });
  const chartPath = `${dir}/inline.tsx`;
  await Deno.writeTextFile(
    chartPath,
    `import { createElement } from "@gggplot/core/jsx";
import { GeomPoint, GGPlot } from "@gggplot/core";
const hidden = { x: [1, 2], y: [3, 4] };
export const chart = () =>
  createElement(GGPlot, { data: hidden, mapping: { x: "x", y: "y" } },
    createElement(GeomPoint, {}));
`,
  );
  try {
    await assertRejects(
      () => runCli(["print", chartPath, `${dir}/out.tsx`]),
      Error,
      "data must be exported",
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("runCli rejects a missing command or chart path", async () => {
  await assertRejects(() => runCli([]), Error, "Usage: gggplot print");
  await assertRejects(
    () => runCli(["compile", FIXTURE]),
    Error,
    "Usage: gggplot print",
  );
});
