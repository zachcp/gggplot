import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  ggplot,
  labels,
  scaleXContinuous,
  scaleZContinuous,
  scaleZDiscrete,
  scaleZLog10,
  scaleZSqrt,
} from "../src/dsl/mod.ts";
import { trainScales } from "../src/scale/mod.ts";
import type { GGSpec } from "../src/ir/types.ts";

const positionData = {
  x: [1, 2, 3],
  y: [10, 20, 30],
  z: [100, 200, 300],
  category: ["near", "far", "near"],
};

function train(spec: GGSpec) {
  return trainScales(spec, [{ data: spec.data, mapping: spec.mapping }]);
}

Deno.test("one position trainer applies limits, expansion, and breaks to x/y/z", () => {
  const xSpec = ggplot(positionData, { x: "x" }).add(
    scaleXContinuous({
      domain: [1, 3],
      expand: [0.1, 1],
      breaks: [1, 2],
      nBreaks: 7,
    }),
  ).build();
  const zSpec = ggplot(positionData, { z: "x" }).add(
    scaleZContinuous({
      domain: [1, 3],
      expand: [0.1, 1],
      breaks: [1, 2],
      nBreaks: 7,
    }),
  ).build();

  const x = train(xSpec).get("x");
  const z = train(zSpec).get("z");
  assertEquals(z, { ...x, aes: "z" });
  assertEquals(z?.domain, [-0.19999999999999996, 4.2]);
  assertEquals(z?.breaks, [1, 2]);
  assertEquals(z?.nBreaks, 7);
});

Deno.test("z scale builders share continuous transforms and discrete levels", () => {
  const logSpec = ggplot(positionData, { z: "z" }).add(scaleZLog10()).build();
  assertEquals(train(logSpec).get("z")?.domain, [2, Math.log10(300)]);

  const sqrtSpec = ggplot(positionData, { z: "z" }).add(scaleZSqrt()).build();
  assertEquals(train(sqrtSpec).get("z")?.domain, [10, Math.sqrt(300)]);

  const discreteSpec = ggplot(positionData, { z: "category" }).add(
    scaleZDiscrete({ domain: ["far", "near"] }),
    labels({ z: "Depth" }),
  ).build();
  assertEquals(train(discreteSpec).get("z")?.domain, ["far", "near"]);
  assertEquals(discreteSpec.labels.z, "Depth");
});

Deno.test("position nBreaks validates once for every axis", () => {
  const spec = ggplot(positionData, { z: "z" }).add(
    scaleZContinuous({ nBreaks: 0 }),
  ).build();
  assertThrows(() => train(spec), Error, "positive integer");
});
