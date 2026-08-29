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
import {
  modelScene3d,
  modelScene3dPrisms,
  modelScene3dSpec,
} from "./model_scene_3d.ts";
import { pickSceneEntity } from "@gggplot/model-inspect";
import type { SceneRay } from "@gggplot/core";
import type { ScenePickPhase } from "./ChartCanvas3D.tsx";
import { ModelTensorInspector } from "./ModelTensorInspector.tsx";
import { Panel } from "./ExampleSection.tsx";
import { styles } from "./styles.ts";
import { assetUrl } from "./asset_url.ts";

type LoadState =
  | { kind: "loading"; name: string }
  // The raw bytes are retained beside the document so a selected tensor can be
  // read on demand. Parsing never copied the weight payload, so this is the
  // only thing that makes bounded tensor content available without refetching.
  | { kind: "ready"; document: ModelDocument; bytes: Uint8Array }
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
  // Selection is owned here so the tensor inspector and any future linked view
  // resolve the same tensor id rather than each keeping private state.
  const [selectedTensorId, setSelectedTensorId] = React.useState<string>();
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
        setSelectedTensorId(undefined);
        setState({
          kind: "ready",
          document,
          bytes: new Uint8Array(model),
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
      const response = await fetch(assetUrl(selectedFixture.path));
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
          <ModelScene
            document={state.document}
            onSelectTensor={setSelectedTensorId}
          />
          <p style={styles.metaCopy}>
            Selecting a tensor reads a bounded range from the same bytes the
            graph was parsed from. The content policy decides whether that
            becomes exact cells, a tile, a downsample, or a summary.
          </p>
          <ModelTensorInspector
            document={state.document}
            modelBytes={state.bytes}
            selectedTensorId={selectedTensorId}
            onSelectTensor={setSelectedTensorId}
          />
        </>
      )}
    </Panel>
  );
}


/**
 * The 3D scene plus its picking wiring.
 *
 * Split out so the scene is built ONCE per document and shared by the spec, the
 * prisms, and the picker. Calling modelScene3d separately for each would work
 * only for as long as layout stays deterministic; sharing the object makes the
 * guarantee structural instead.
 */
/**
 * Hovering must not re-render the WebGPU scene.
 *
 * Two reasons, one of them load-bearing. Rebuilding the live tree on every
 * pointer move is wasteful on its own; worse, plot's <Grid> is memoized with
 * shouldEqual({ first: sameShallow(), second: sameShallow() }) and we pass
 * null for whichever side a single-axis grid does not draw — which is exactly
 * what grid.mjs asks for. @use-gpu/traits' sameArray then evaluates
 * `typeof a === "object" && "length" in a`, and because typeof null is
 * "object" it throws on that null. The comparator only runs on RE-RENDER, so
 * an unmemoized hover handler turns a latent upstream bug into an exception on
 * every pointer move. See gggplot-cfe.
 */
const MemoizedCanvas3D = React.memo(ChartCanvas3D);

function ModelScene(
  {
    document,
    onSelectTensor,
  }: {
    document: ModelDocument;
    onSelectTensor: (id: string | undefined) => void;
  },
) {
  // Hover state lives HERE, not in the parent. Lifting it re-renders every
  // sibling on the page on each pointer move — including other chart surfaces,
  // whose grids then hit the memo bug described above. Kept local, a hover
  // re-renders only the readout below.
  const [hoveredEntityId, setHoveredEntityId] = React.useState<string>();
  const scene = React.useMemo(() => modelScene3d(document), [document]);
  const spec = React.useMemo(() => modelScene3dSpec(scene), [scene]);
  const prisms = React.useMemo(() => modelScene3dPrisms(scene), [scene]);

  const handlePick = React.useCallback(
    (ray: SceneRay | null, phase: ScenePickPhase) => {
      const hit = ray
        ? pickSceneEntity(scene, ray.origin, ray.direction)
        : null;
      if (phase === "hover") {
        setHoveredEntityId(hit?.id);
        return;
      }
      // Only tensor-backed slabs drive the shared selection; clicking a module
      // or empty space must not clear a selection the user made deliberately.
      if (hit?.tensorId) onSelectTensor(hit.tensorId);
    },
    [scene, onSelectTensor],
  );

  const hovered = hoveredEntityId
    ? scene.entities.find((entity) => entity.id === hoveredEntityId)
    : undefined;

  return (
    <>
      <MemoizedCanvas3D
        spec={spec}
        prismInstances={prisms}
        label={"3D ONNX tensor and connector scene for " + document.name}
        onPick={handlePick}
      />
      <p
        style={styles.metaCopy}
        data-scene-hover={hoveredEntityId ?? ""}
        data-scene-hover-tensor={hovered?.tensorId ?? ""}
      >
        {hovered
          ? `Hovering ${hovered.kind} ${hovered.tensorId ?? hovered.id}` +
            (hovered.tensorId ? " · click to inspect this tensor" : "")
          : "Hover a tensor slab or operator module to identify it."}
      </p>
    </>
  );
}
