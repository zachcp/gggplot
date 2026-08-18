import React from "react";
import {
  type ArtifactSource,
  inspectOnnx,
  type ModelDocument,
} from "@gggplot/model-inspect";
import { ChartCanvas3D } from "./ChartCanvas3D.tsx";
import {
  DEFAULT_MODEL_FIXTURE,
  fixtureById,
  MODEL_FIXTURES,
} from "./model_fixtures.ts";
import { modelScene3dPrisms, modelScene3dSpec } from "./model_scene_3d.ts";
import { Panel } from "./ExampleSection.tsx";
import { styles } from "./styles.ts";

type LoadState =
  | { kind: "loading"; name: string }
  | { kind: "ready"; document: ModelDocument }
  | { kind: "error"; message: string };

interface LoadedArtifact {
  source: ArtifactSource;
  model: ArrayBuffer;
}

async function inspectOnnxBytes(
  source: ArtifactSource,
  model: ArrayBuffer,
): Promise<ModelDocument> {
  // Static inspection is the graph authority. It avoids executing an
  // untrusted model and retains only lazy initializer byte ranges.
  return inspectOnnx(new Uint8Array(model), { source }).document;
}

/**
 * Local, non-executing ONNX inspection. Runtime execution remains an optional
 * adapter path; the visible graph comes from direct portable artifact parsing.
 */
export function OnnxRuntimeCanvas() {
  const [state, setState] = React.useState<LoadState>({
    kind: "loading",
    name: DEFAULT_MODEL_FIXTURE.label,
  });
  const [fixtureId, setFixtureId] = React.useState(DEFAULT_MODEL_FIXTURE.id);
  const loadEpoch = React.useRef(0);
  const selectedFixture = fixtureById(fixtureId);

  const loadArtifact = React.useCallback(
    async (name: string, read: () => Promise<LoadedArtifact>) => {
      const epoch = ++loadEpoch.current;
      setState({ kind: "loading", name });
      try {
        const { source, model } = await read();
        const document = await inspectOnnxBytes(source, model);
        if (epoch !== loadEpoch.current) return;
        setState({
          kind: "ready",
          document,
        });
      } catch (error) {
        if (epoch !== loadEpoch.current) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [],
  );

  React.useEffect(() => {
    void loadArtifact(selectedFixture.label, async () => {
      const response = await fetch(selectedFixture.path);
      if (!response.ok) {
        throw new Error(
          "Bundled ONNX model request failed: " + response.status,
        );
      }
      const model = await response.arrayBuffer();
      return {
        source: {
          id: "url:" + selectedFixture.path,
          format: "onnx",
          kind: "url",
          uri: selectedFixture.path,
          byteLength: model.byteLength,
        },
        model,
      };
    });
  }, [loadArtifact, selectedFixture]);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await loadArtifact(
      file.name,
      async () => ({
        source: {
          id: "file:" + file.name + ":" + file.size + ":" + file.lastModified,
          format: "onnx",
          kind: "file",
          uri: file.name,
          byteLength: file.size,
        },
        model: await file.arrayBuffer(),
      }),
    );
  };

  return (
    <Panel title="Choose an ONNX model">
      <p style={styles.metaCopy}>
        Each local artifact is parsed directly into operator, tensor, and
        data-flow metadata. The curated fixtures compare layout classes; weight
        bytes stay lazy until a tensor-content view requests a bounded range.
      </p>
      <label style={styles.modelFixtureLabel}>
        Curated layout fixture
        <select
          aria-label="Curated ONNX layout fixture"
          value={fixtureId}
          onChange={(event) => setFixtureId(event.target.value)}
          style={styles.modelFixtureSelect}
        >
          {MODEL_FIXTURES.map((fixture) => (
            <option key={fixture.id} value={fixture.id}>
              {fixture.label} — {fixture.topology}
            </option>
          ))}
        </select>
      </label>
      <p style={styles.metaCopy}>
        {selectedFixture.description}
      </p>
      <p style={styles.fileInputLabel}>Or inspect another local ONNX file</p>
      <input
        type="file"
        accept=".onnx,application/octet-stream"
        onChange={onFile}
        style={styles.fileInput}
      />
      {state.kind === "loading" && (
        <p style={styles.metaCopy}>Loading {state.name}…</p>
      )}
      {state.kind === "error" && (
        <p role="alert" style={styles.errorCopy}>{state.message}</p>
      )}
      {state.kind === "ready" && (
        <>
          <p style={styles.metaCopy}>
            {state.document.name} · {state.document.graphs[0].nodes.length}{" "}
            graph nodes · drag to orbit · Shift-drag or right-drag to pan ·
            scroll to zoom through tensor slabs and routed connectors
          </p>
          <ChartCanvas3D
            spec={modelScene3dSpec(state.document)}
            prismInstances={modelScene3dPrisms(state.document)}
            label={"3D ONNX tensor and connector scene for " +
              state.document.name}
          />
        </>
      )}
    </Panel>
  );
}
