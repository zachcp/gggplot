// Keep static-data loading independent of the browser Live renderer exported
// by the package barrel. This module only needs typed ingestion semantics.
import {
  ingest,
  type TypedDataFrame,
} from "../../../../../packages/core/src/data/mod.ts";
import { parseCsvColumns } from "./csv_parse.ts";

export { type CsvColumnStore, parseCsvColumns } from "./csv_parse.ts";

export function typedCsv(
  text: string,
  omit: readonly string[] = ["rownames"],
): TypedDataFrame {
  const columns = parseCsvColumns(text);
  for (const name of omit) delete columns[name];
  return ingest(columns);
}
