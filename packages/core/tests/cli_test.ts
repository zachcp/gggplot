import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { runCli } from "../src/cli.ts";

const FIXTURE = new URL("./fixtures/demo-spec.ts", import.meta.url).pathname;

Deno.test("runCli compiles a spec module to emitted UseGPU Live source", async () => {
  const outPath = await Deno.makeTempFile({ suffix: ".tsx" });
  try {
    const written = await runCli(["compile", FIXTURE, outPath]);
    assertEquals(written, outPath);

    const src = await Deno.readTextFile(outPath);
    assertStringIncludes(src, "@jsx createElement");
    assertStringIncludes(src, "<Point");
    assertStringIncludes(src, "<Line");
  } finally {
    await Deno.remove(outPath);
  }
});

Deno.test("runCli names the exported component from the output filename by default", async () => {
  const dir = await Deno.makeTempDir();
  const outPath = `${dir}/scatter_chart.tsx`;
  try {
    await runCli(["compile", FIXTURE, outPath]);
    const src = await Deno.readTextFile(outPath);
    assertStringIncludes(src, "export const ScatterChart");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("runCli honors an explicit --name= override", async () => {
  const outPath = await Deno.makeTempFile({ suffix: ".tsx" });
  try {
    await runCli(["compile", FIXTURE, outPath, "--name=MyChart"]);
    const src = await Deno.readTextFile(outPath);
    assertStringIncludes(src, "export const MyChart");
  } finally {
    await Deno.remove(outPath);
  }
});

Deno.test("runCli rejects a missing spec argument", async () => {
  await assertRejects(() => runCli(["compile"]), Error, "Usage:");
});
