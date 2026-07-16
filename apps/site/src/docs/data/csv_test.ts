import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { parseCsvColumns } from "./csv_parse.ts";

Deno.test("CSV assets parse quoted values while retaining column shape", () => {
  const data = parseCsvColumns(
    'rownames,value,label\n1,2,"two, words"\n2,,plain\n',
  );
  assertEquals(data.value, ["2", null]);
  assertEquals(data.label, ["two, words", "plain"]);
});

Deno.test("CSV parser rejects malformed records", () => {
  assertThrows(() => parseCsvColumns("x,y\n1\n"), Error, "header width");
  assertThrows(
    () => parseCsvColumns('x\n"unterminated'),
    Error,
    "Unterminated",
  );
});
