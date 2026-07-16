export type CsvColumnStore = Record<string, Array<string | null>>;

/** Parses static CSV assets while retaining their column-oriented shape. */
export function parseCsvColumns(text: string): CsvColumnStore {
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      rows.at(-1)!.push(cell);
      cell = "";
    } else if (char === "\n") {
      rows.at(-1)!.push(cell.replace(/\r$/, ""));
      rows.push([]);
      cell = "";
    } else cell += char;
  }
  if (cell || rows.at(-1)!.length) rows.at(-1)!.push(cell.replace(/\r$/, ""));
  if (quoted) throw new Error("Unterminated quoted CSV cell");
  const [header, ...body] = rows.filter((row) =>
    row.length > 0 && (row.length > 1 || row[0] !== "")
  );
  if (!header?.length) return {};
  if (new Set(header).size !== header.length) {
    throw new Error("CSV headers must be unique");
  }
  const columns: CsvColumnStore = Object.fromEntries(
    header.map((name) => [name, []]),
  );
  for (const row of body) {
    if (row.length !== header.length) {
      throw new Error("CSV row does not match header width");
    }
    for (let index = 0; index < header.length; index++) {
      columns[header[index]].push(row[index] === "" ? null : row[index]);
    }
  }
  return columns;
}
