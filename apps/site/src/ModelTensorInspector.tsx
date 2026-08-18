import React from "react";
import {
  buildTensorContentProduct,
  ByteArrayTensorSource,
  type ModelDocument,
  type TensorContentProduct,
} from "@gggplot/model-inspect";
import { ChartCanvas } from "./ChartCanvas.tsx";
import {
  tensorInventory,
  tensorInventorySpec,
  tensorMatrixSpec,
  trailingMatrixRequest,
} from "./model_tensor_views.ts";
import { styles } from "./styles.ts";

/**
 * Interactive tensor inspection over an already-parsed model document.
 *
 * Selection is a host callback rather than internal view state: the graph
 * scene, the inventory, and the matrix all key off the same tensor id, so the
 * owner of that id has to be the host if those views are ever to stay linked.
 */
export function ModelTensorInspector(
  {
    document,
    modelBytes,
    selectedTensorId,
    onSelectTensor,
  }: {
    document: ModelDocument;
    modelBytes: Uint8Array;
    selectedTensorId?: string;
    onSelectTensor?: (tensorId: string) => void;
  },
) {
  const entries = React.useMemo(
    () => tensorInventory(document),
    [document],
  );
  const [internalId, setInternalId] = React.useState<string | undefined>();
  const activeId = selectedTensorId ?? internalId ?? entries[0]?.tensorId;
  const [product, setProduct] = React.useState<TensorContentProduct>();
  const [error, setError] = React.useState<string>();

  const select = (tensorId: string) => {
    setInternalId(tensorId);
    onSelectTensor?.(tensorId);
  };

  React.useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    const descriptor = document.tensors[activeId];
    if (!descriptor) return;
    // Bytes are read only when a tensor is actually selected; parsing the
    // graph never touched the weight payload.
    const source = new ByteArrayTensorSource(
      document.source.id,
      document.source.version ?? "v1",
      modelBytes,
    );
    buildTensorContentProduct(
      document,
      source,
      trailingMatrixRequest(activeId, descriptor.shape),
    )
      .then((next) => {
        if (cancelled) return;
        setProduct(next);
        setError(undefined);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setProduct(undefined);
        setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [document, modelBytes, activeId]);

  if (entries.length === 0) {
    return (
      <p style={styles.metaCopy}>
        This model exposes no stored parameter tensors to inspect.
      </p>
    );
  }

  const inventorySpec = tensorInventorySpec(document);
  const matrixSpec = product ? tensorMatrixSpec(product) : undefined;

  return (
    <>
      {inventorySpec && (
        <ChartCanvas
          spec={inventorySpec}
          label={"Parameter bytes by tensor for " + document.id}
        />
      )}
      <label style={styles.modelFixtureLabel}>
        Tensor to inspect
        <select
          aria-label="Tensor to inspect"
          value={activeId}
          onChange={(event) => select(event.target.value)}
          style={styles.modelFixtureSelect}
        >
          {entries.map((entry) => (
            <option key={entry.tensorId} value={entry.tensorId}>
              {entry.label} — {(entry.byteLength / 1024).toFixed(1)} KiB
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert" style={styles.errorCopy}>{error}</p>}
      {product && !matrixSpec && (
        <p style={styles.metaCopy}>
          Bounded as “{product.representation}” — too large to draw cell by
          cell.{product.diagnostics.length > 0
            ? " " + product.diagnostics.join(" ")
            : ""}
        </p>
      )}
      {product && matrixSpec && (
        <>
          <p style={styles.metaCopy}>
            {product.representation} · {product.gridShape?.[0]}×{product
              .gridShape?.[1]} cells from shape{" "}
            {JSON.stringify(product.descriptor.shape)}
          </p>
          <ChartCanvas
            spec={matrixSpec}
            label={"Tensor value heatmap for " + activeId}
          />
        </>
      )}
    </>
  );
}
