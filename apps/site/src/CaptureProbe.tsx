import { LiveCanvas } from "@use-gpu/react";
// Live elements are built with the typed factory, not React JSX: a Live
// scene returns a LiveElement, which React's JSX namespace rejects.
import { createElement as liveElement } from "@gggplot/core/jsx";
import { allDocExamples } from "./docs/examples.tsx";
import { docPages } from "./docs/pages.ts";
import { ChartScene } from "./chart_scene.tsx";
import { Scene3D } from "./scene3d.tsx";
import { threeDShowcases } from "./docs/example_3d.tsx";

/**
 * `?capture=<ExampleId>`: one doc example's chart alone on a fixed-size
 * canvas, so a script can grab its swap-chain frame (scripts/
 * example_frames.ts): the golden-frame gate (gggplot-w8zq) and parity checks
 * across refactors that must not change output. 3D showcases resolve too.
 */
export function CaptureProbe({ id }: { id: string }) {
  const example = [
    ...allDocExamples,
    ...docPages.flatMap((page) => page.examples ?? []),
  ].find((e) => e.id === id);
  const showcase = threeDShowcases.find((s) => s.id === id);
  if (!example && !showcase) {
    return <p id="capture-missing">No example {id}</p>;
  }
  return (
    <div id="capture-canvas" style={{ width: 640, height: 400 }}>
      <LiveCanvas>
        {(canvas: HTMLCanvasElement) =>
          example
            ? liveElement(ChartScene, { canvas, chart: example.chart })
            : liveElement(Scene3D, { canvas, chart: showcase!.chart })}
      </LiveCanvas>
    </div>
  );
}
