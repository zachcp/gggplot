import { LiveCanvas } from "@use-gpu/react";
import { allDocExamples } from "./docs/examples.tsx";
import { docPages } from "./docs/pages.ts";
import { Scene } from "./scene.tsx";

/**
 * `?capture=<ExampleId>`: one doc example alone on a fixed-size canvas, so a
 * script can grab its swap-chain frame (scripts/example_frames.ts). Used to
 * hold pixel parity across refactors that should not change any output.
 */
export function CaptureProbe({ id }: { id: string }) {
  const example = [
    ...allDocExamples,
    ...docPages.flatMap((page) => page.examples ?? []),
  ].find((e) => e.id === id);
  if (!example?.spec) return <p id="capture-missing">No example {id}</p>;
  return (
    <div id="capture-canvas" style={{ width: 640, height: 400 }}>
      <LiveCanvas>
        {(canvas: HTMLCanvasElement) => (
          <Scene canvas={canvas} spec={example.spec!} />
        )}
      </LiveCanvas>
    </div>
  );
}
