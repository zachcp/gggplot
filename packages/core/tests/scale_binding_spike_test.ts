import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import * as Live from "@use-gpu/live";
import {
  cpuAudit,
  scaleParameters,
  spikeScales,
  updateParameters,
} from "../spikes/gpu_scale_binding.ts";
import {
  createElement,
  makeContext,
  provide,
  useContext,
} from "../src/runtime/usegpu_compat.ts";

Deno.test("scale spike keeps GPU refs stable across a domain commit", () => {
  const refs = scaleParameters(spikeScales());
  const before = { ...refs };
  updateParameters(refs, spikeScales(13, "#1baf7a"));
  for (const key of Object.keys(refs) as (keyof typeof refs)[]) {
    assertStrictEquals(refs[key], before[key]);
  }
  assertEquals(refs.colorDomain.current, [1, 13]);
  assertEquals(refs.fixed.current, [27 / 255, 175 / 255, 122 / 255, 1]);
  assertThrows(() =>
    scaleParameters({
      ...spikeScales(),
      color: { aes: "color", kind: "discrete", domain: ["a"] },
    })
  );
});

Deno.test("scale spike CPU reference retains area size semantics and raw-row identity", () => {
  const sample = cpuAudit(spikeScales(), Uint32Array.of(4, 2, 0), 8);
  assertEquals(sample[4], Math.fround(8 + Math.sqrt(1 / 3) * 16));
  assertEquals(sample[16], 8);
  assertEquals(sample[28], 24);
  assertEquals([sample[6], sample[18], sample[30]], [8, 8, 8]);
});

Deno.test("stable shader refs need a separate context revision to notify CPU guides", () => {
  const namespace = Live as unknown as {
    default?: { renderSync?: unknown };
    renderSync?: unknown;
  };
  const api = namespace.default?.renderSync ? namespace.default : namespace;
  const render = api.renderSync as (calls: unknown, fiber?: unknown) => unknown;
  const context = makeContext<unknown>(null, "ScaleBindingRevisionTest");
  const refs = scaleParameters(spikeScales());
  const seen: unknown[] = [];
  const guide = createElement(() => {
    seen.push(
      useContext<{ refs: typeof refs }>(context).refs.colorDomain.current,
    );
    return null;
  });
  const stable = { refs, revision: 1 };
  let fiber = render(provide(context, stable, guide));
  updateParameters(refs, spikeScales(13));
  fiber = render(provide(context, stable, guide), fiber);
  assertEquals(
    seen,
    [[1, 7]],
    "negative control: mutating refs alone does not notify guides",
  );
  render(provide(context, { refs, revision: 2 }, guide), fiber);
  assertEquals(seen, [[1, 7], [1, 13]]);
});
