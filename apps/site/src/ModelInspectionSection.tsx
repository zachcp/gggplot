import type { ModelInspectionExample } from "./docs/types.ts";
import { Panel } from "./ExampleSection.tsx";
import { OnnxRuntimeCanvas } from "./OnnxRuntimeCanvas.tsx";
import { styles } from "./styles.ts";

export function ModelInspectionSection({
  example,
}: { example: ModelInspectionExample }) {
  const graph = example.document.graphs[0];
  const tensors = Object.values(example.document.tensors);
  return (
    <section data-doc-model-example={example.id} style={styles.example}>
      <div style={styles.exampleHeader}>
        <div style={styles.exampleIndex}>AI</div>
        <div>
          <h3 style={styles.exampleTitle}>{example.title}</h3>
          <p style={styles.exampleDescription}>{example.description}</p>
        </div>
      </div>
      <div style={styles.detailGrid}>
        <Panel title="Model document">
          <p style={styles.metaCopy}>
            {example.document.name} · {example.document.source.format} · schema
            {" "}
            {example.document.schema}
          </p>
          <p style={styles.metaCopy}>
            {graph.nodes.length} graph nodes · {graph.edges.length} edges ·{" "}
            {tensors.length} tensors
          </p>
        </Panel>
        <Panel title="Post-loading storage">
          <p style={styles.metaCopy}>
            <strong>{example.ownership}</strong>
          </p>
          <p style={styles.metaCopy}>{example.ownershipReason}</p>
        </Panel>
      </div>
      <section style={styles.grid}>
        <Panel title="Graph structure">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Node</th>
                <th style={styles.th}>Operator</th>
                <th style={styles.th}>Parameters</th>
              </tr>
            </thead>
            <tbody>
              {graph.nodes.map((node) => (
                <tr key={node.id}>
                  <td style={styles.td}>{node.name ?? node.id}</td>
                  <td style={styles.td}>
                    <code>{node.op ?? node.kind}</code>
                  </td>
                  <td style={styles.td}>{node.parameters?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Tensor inventory">
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Tensor</th>
                  <th style={styles.th}>Shape</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Residency</th>
                </tr>
              </thead>
              <tbody>
                {tensors.map((tensor) => (
                  <tr key={tensor.id}>
                    <td style={styles.td}>{tensor.name ?? tensor.id}</td>
                    <td style={styles.td}>
                      {tensor.shape.map((dimension) =>
                        typeof dimension === "number" ? dimension : "?"
                      ).join(" × ")}
                    </td>
                    <td style={styles.td}>{tensor.role}</td>
                    <td style={styles.td}>
                      {tensor.residency?.policy ?? "metadata"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
      <details style={styles.details}>
        <summary style={styles.summary}>Canonical model JSON</summary>
        <pre
          style={styles.pre}
        >{JSON.stringify(example.document, null, 2)}</pre>
      </details>
      <OnnxRuntimeCanvas />
    </section>
  );
}
