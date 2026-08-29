import React from "react";
import type { DataFrame, GGSpec } from "@gggplot/core";
import { loadStaticDataset } from "./docs/data/real.ts";
import type { DocExample } from "./docs/types.ts";

export interface ResolvedExample {
  spec?: GGSpec;
  data?: DataFrame;
  error?: string;
}

/** Resolve real datasets only for mounted examples; static specs stay immediate. */
export function useResolvedExample(example: DocExample): ResolvedExample {
  const [resolved, setResolved] = React.useState<ResolvedExample>(() => ({
    spec: example.spec,
  }));

  React.useEffect(() => {
    if (!example.dataSource) {
      setResolved({ spec: example.spec });
      return;
    }
    let cancelled = false;
    setResolved({});
    loadStaticDataset(example.dataSource.id)
      .then((data) => {
        if (!cancelled) setResolved({ data, spec: example.buildSpec?.(data) });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResolved({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [example]);

  return resolved;
}

export function useViewportWidth(): number {
  const [width, setWidth] = React.useState(() =>
    typeof window === "undefined" ? 1280 : globalThis.innerWidth
  );

  React.useEffect(() => {
    const onResize = () => setWidth(globalThis.innerWidth);
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);

  return width;
}
