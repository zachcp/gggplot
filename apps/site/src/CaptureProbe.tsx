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
import { Scene3D } from "./scene3d.tsx";
import { threeDShowcases } from "./docs/example_3d.tsx";
import { useResolvedExample } from "./hooks.ts";
import { loadStaticDataset } from "./docs/data/real.ts";

/** One stable producer per dataset: a new function would be a new load. */
const loaders = new Map<string, () => ReturnType<typeof loadStaticDataset>>();
const datasetLoader = (id: "mpg" | "mtcars" | "iris") => {
  if (!loaders.has(id)) loaders.set(id, () => loadStaticDataset(id));
  return loaders.get(id)!;
};

/**
 * `?capture=<ExampleId>`: one doc example alone on a fixed-size canvas, so a
 * script can grab its swap-chain frame (scripts/example_frames.ts). Used to
 * hold pixel parity across refactors that should not change any output.
 */
const hasSpec = (example: DocExample) => !!example.spec || !!example.buildSpec;

export function CaptureProbe(
  { id, path = "compile" }: { id: string; path?: string },
) {
  const example = [
    ...allDocExamples,
    ...docPages.flatMap((page) => page.examples ?? []),
  ].find((e) => e.id === id);
  const showcase = threeDShowcases.find((s) => s.id === id);
  if (!example && showcase) {
    // A 3D showcase: its spec on the compile path, its chart on `chart`.
    return (
      <div id="capture-canvas" style={{ width: 640, height: 400 }}>
        <LiveCanvas>
          {(canvas: HTMLCanvasElement) =>
            liveElement(
              Scene3D,
              path === "chart" || !showcase.spec
                ? { canvas, chart: showcase.chart }
                : { canvas, spec: showcase.spec },
            )}
        </LiveCanvas>
      </div>
    );
  }
  if (!example) return <p id="capture-missing">No example {id}</p>;
  if (example.chart && (path === "chart" || !hasSpec(example))) {
    // `&path=chart` renders the hand-written JSX (gggplot-vnh.10.1); an
    // example with no spec has only that path.
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
          // root (gggplot-b7f), for frame-by-frame parity; a dataset
          // example's frame then comes through <GGData load> (gggplot-y43).
          path === "component"
            ? liveElement(ComponentScene, {
              canvas,
              spec,
              ...(example.dataSource
                ? { load: datasetLoader(example.dataSource.id) }
                : {}),
            })
            : liveElement(Scene, { canvas, spec })}
      </LiveCanvas>
    </div>
  );
}
