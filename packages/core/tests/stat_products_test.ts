// gggplot-l82: every stat is a product behind one interface.
import { assert, assertEquals, assertStrictEquals } from "@std/assert";
import {
  applyStat,
  CPU_STAT_PRODUCTS,
  createCpuStatCache,
  GPU_STAT_PRODUCTS,
  statProduct,
} from "../src/stat/mod.ts";
import { ingest, touchColumn } from "../src/data/mod.ts";
import type { Layer } from "../src/ir/types.ts";

const layer = (stat: Layer["stat"], params = {}): Layer => ({
  geom: "bar",
  stat,
  position: "identity",
  params,
});

Deno.test("every stat has a CPU product, and applyStat runs it", () => {
  const stats = Object.keys(CPU_STAT_PRODUCTS) as Layer["stat"][];
  assert(stats.length >= 30);
  for (const stat of stats) {
    const product = CPU_STAT_PRODUCTS[stat];
    assertEquals(product.executor, "cpu");
    assertEquals(product.stat, stat);
    assertEquals(product.id, `@gggplot/core:stat_${stat}@1`);
  }
  const data = ingest({ x: ["a", "b", "a", "c"] });
  assertEquals(
    applyStat(layer("count"), { x: "x" }, data),
    CPU_STAT_PRODUCTS.count.run(data, { x: "x" }, {}),
  );
});

Deno.test("count and bin also have GPU products over the same interface", () => {
  assertEquals(statProduct(CPU_STAT_PRODUCTS, "count").executor, "cpu");
  const gpu = statProduct(CPU_STAT_PRODUCTS, "count", true);
  assertEquals(gpu.executor, "gpu");
  assertStrictEquals(gpu, GPU_STAT_PRODUCTS.count);
  assert(GPU_STAT_PRODUCTS.bin?.stage, "stat_bin sizes its grid from a stage");
  // No GPU form: the CPU product, even when preferred.
  assertEquals(statProduct(CPU_STAT_PRODUCTS, "smooth", true).executor, "cpu");
});

Deno.test("the CPU stat cache reruns only when an input version moves", () => {
  const cache = createCpuStatCache();
  const data = ingest({ x: [1, 2, 2, 3, 9] });
  const binLayer = layer("bin", { bins: 3 });
  const first = cache.run(CPU_STAT_PRODUCTS.bin, binLayer, { x: "x" }, data);
  const again = cache.run(CPU_STAT_PRODUCTS.bin, binLayer, { x: "x" }, data);
  assertStrictEquals(again, first);
  assertEquals(cache.misses, 1);
  // Different params: a different run.
  cache.run(CPU_STAT_PRODUCTS.bin, layer("bin", { bins: 4 }), { x: "x" }, data);
  assertEquals(cache.misses, 2);
  // An in-place change, declared with touchColumn, invalidates.
  data.x.values[4] = 4;
  touchColumn(data.x);
  const after = cache.run(CPU_STAT_PRODUCTS.bin, binLayer, { x: "x" }, data);
  assert(after !== first);
  assertEquals(cache.misses, 3);
  assertEquals(after, applyStat(binLayer, { x: "x" }, data));
});
