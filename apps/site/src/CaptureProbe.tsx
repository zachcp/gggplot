import { LiveCanvas } from "@use-gpu/react";
// Live elements are built with the typed factory, not React JSX: a Live
// scene returns a LiveElement, which React's JSX namespace rejects.
import { createElement as liveElement } from "@gggplot/core/jsx";
import { allDocExamples } from "./docs/examples.tsx";
import { docPages } from "./docs/pages.ts";
import type { DocExample } from "./docs/types.ts";
import { Scene } from "./scene.tsx";
import { ComponentScene } from "./component_scene.tsx";
import { ChartScene } from "./chart_scene.tsx";
import { useResolvedExample } from "./hooks.ts";

/**
 * `?capture=<ExampleId>`: one doc example alone on a fixed-size canvas, so a
 * script can grab its swap-chain frame (scripts/example_frames.ts). Used to
 * hold pixel parity across refactors that should not change any output.
 */
export function CaptureProbe(
  { id, path = "compile" }: { id: string; path?: string },
) {
  const example = [
    ...allDocExamples,
    ...docPages.flatMap((page) => page.examples ?? []),
  ].find((e) => e.id === id);
  if (!example) return <p id="capture-missing">No example {id}</p>;
  if (example.chart) {
    // A component-form example has one path: the component root.
    return (
      <div id="capture-canvas" style={{ width: 640, height: 400 }}>
        <LiveCanvas>
          {(canvas: HTMLCanvasElement) =>
            liveElement(ChartScene, { canvas, chart: example.chart! })}
        </LiveCanvas>
      </div>
    );
  }
  return <CaptureExample example={example} path={path} />;
}

function CaptureExample(
  { example, path }: { example: DocExample; path: string },
) {
  // Dataset examples (`dataSource` + `buildSpec`) resolve their spec first.
  const { spec } = useResolvedExample(example);
  if (!spec) return <p id="capture-loading">Loading {example.id}</p>;
  return (
    <div id="capture-canvas" style={{ width: 640, height: 400 }}>
      <LiveCanvas>
        {(canvas: HTMLCanvasElement) =>
          // `&path=component` renders the same spec through the component
          // root (gggplot-b7f), for frame-by-frame parity.
          liveElement(path === "component" ? ComponentScene : Scene, {
            canvas,
            spec,
          })}
      </LiveCanvas>
    </div>
  );
}
