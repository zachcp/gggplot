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
  tensorInventoryChart,
  tensorMatrixChart,
  trailingMatrixRequest,
} from "./model_tensor_views.tsx";
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
  const requestedId = selectedTensorId ?? internalId;
  const activeId = entries.some((entry) => entry.tensorId === requestedId)
    ? requestedId
    : entries[0]?.tensorId;
  const [product, setProduct] = React.useState<TensorContentProduct>();
  const [error, setError] = React.useState<string>();

  const select = (tensorId: string) => {
    setInternalId(tensorId);
    onSelectTensor?.(tensorId);
  };

  React.useEffect(() => {
    setProduct(undefined);
    setError(undefined);
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

  const inventoryChart = React.useMemo(() => {
    const chart = tensorInventoryChart(document);
    return chart && (() => chart);
  }, [document]);
  const activeProduct = product?.descriptor === document.tensors[activeId!]
    ? product
    : undefined;
  const matrixChart = React.useMemo(() => {
    const chart = activeProduct ? tensorMatrixChart(activeProduct) : undefined;
    return chart && (() => chart);
  }, [activeProduct]);

  return (
    <>
      {inventoryChart && (
        <ChartCanvas
          chart={inventoryChart}
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
      {activeProduct && !matrixChart && (
        <p style={styles.metaCopy}>
          Bounded as “{activeProduct.representation}” — too large to draw cell
          by cell.{activeProduct.diagnostics.length > 0
            ? " " + activeProduct.diagnostics.join(" ")
            : ""}
        </p>
      )}
      {activeProduct && matrixChart && (
        <>
          <p style={styles.metaCopy}>
            {activeProduct.representation} ·{" "}
            {activeProduct.gridShape?.[0]}×{activeProduct
              .gridShape?.[1]} cells from shape{" "}
            {JSON.stringify(activeProduct.descriptor.shape)}
          </p>
          <ChartCanvas
            chart={matrixChart}
            label={"Tensor value heatmap for " + activeId}
          />
        </>
      )}
    </>
  );
}
