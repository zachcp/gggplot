// The data tier: <GGData> mounts a frame's columns once and provides them to
// every plot, layer and product below it (gggplot-lbk, ADR-007 decision 6).
//
// Mount it ABOVE <Plot>. Each column is its own keyed fiber that uploads with a
// flat raw-source hook and reports its source through Live Capture, so a
// column arriving late mounts one new fiber and touches no other: a single
// component with one hook per column would change its hook count and have to
// remount, re-uploading everything. The continuation provides GGDataContext.
//
// Kept leaf-ward: imports only data/, plan types and the runtime's mount
// planner, never render/ or compile/ (vs7 trap 4: runtime module cycles fail
// silently).
import type { LiveElement } from "@use-gpu/live";
import { ingest, type InputData } from "../data/mod.ts";
import type { FieldSpec } from "../plan/mod.ts";
import { planColumnMounts } from "../runtime/live.tsx";
import {
  type GPUStorageSource,
  isResidentColumn,
  type MountedColumn,
  type MountedDataFrame,
} from "../runtime/types.ts";
import {
  capture,
  createElement,
  makeCapture,
  makeContext,
  provide,
  QueueReconciler,
  useCapture,
  useContext,
  useMemo,
  useNoRawSource,
  useOne,
  useRawSource,
} from "../runtime/usegpu_compat.ts";

/** One mounted column as the data tier exposes it. */
export interface GGDataColumn {
  source: GPUStorageSource;
  /** The column's content version (gggplot-67c); 0 for a resident column. */
  version: number;
  dtype: "f32" | "u32";
}

/** What `<GGData>` provides: the CPU frame and its mounted GPU columns. */
export interface GGDataValue {
  /** The frame as mounted: plain columns, or ADR-006 resident ones. */
  frame: MountedDataFrame;
  columns: Record<string, GGDataColumn>;
}

/** A Live context (the compat surface types contexts as opaque). */
export const GGDataContext: unknown = makeContext<GGDataValue | null>(
  null,
  "GGDataContext",
);

/** The nearest `<GGData>`'s frame and columns, or null outside one. */
export function useGGData(): GGDataValue | null {
  return useContext<GGDataValue | null>(GGDataContext);
}

const ColumnCapture = makeCapture("GGDataColumns");

interface MountedReport {
  name: string;
  column: GGDataColumn;
}

/** One-element stand-ins for an empty column (a zero-byte binding is invalid). */
const EMPTY = { f32: new Float32Array(1), u32: new Uint32Array(1) };

const fieldFor = (name: string, column: MountedColumn): FieldSpec => ({
  name,
  dtype: column.type === "factor" ? "u32" : "f32",
  shape: "row",
  dimensions: ["row"],
});

/** Mounts one column and reports its source. */
const MountColumn = (
  { name, column }: { name: string; column: MountedColumn },
): LiveElement => {
  const [mount] = planColumnMounts({ [name]: column }, [
    fieldFor(name, column),
  ]);
  let report: MountedReport | null = null;
  if (mount.kind === "upload") {
    const empty = mount.array.length === 0;
    const source = useRawSource(
      empty ? EMPTY[mount.format] : mount.array,
      mount.format,
      undefined,
      undefined,
      mount.version,
    );
    report = {
      name,
      column: {
        source: empty ? { ...source, length: 0, size: [0] } : source,
        version: mount.version,
        dtype: mount.format,
      },
    };
  } else {
    useNoRawSource();
    if (mount.kind === "resident") {
      report = {
        name,
        column: {
          source: mount.source,
          version: 0,
          dtype: isResidentColumn(column) && column.type === "factor"
            ? "u32"
            : "f32",
        },
      };
    }
  }
  // A new upload must schedule the frame that dispatches whatever reads it,
  // as <RawData> did; see runtime/live.tsx.
  const version = report?.column.source.version ?? -1;
  const trigger = useOne(() => QueueReconciler.signal(), version);
  // Report a value whose identity moves only when the source does, so the
  // continuation's memo below holds across unrelated re-renders.
  const reported = useMemo(
    () => report,
    [report?.column.source, report?.column.source.version],
  );
  useCapture(ColumnCapture, reported);
  return trigger;
};

export interface GGDataProps {
  /** Raw columns/rows, an ingested frame, or one mixing resident columns. */
  data: InputData | MountedDataFrame;
  /** Mount only these columns. Default: every column in the frame. */
  columns?: readonly string[];
  children?: unknown;
}

/**
 * Mounts `data`'s columns once as GPU storage sources and provides them, with
 * the CPU frame, through GGDataContext. Everything below shares the one
 * upload: several layers, several plots, and the products that read them.
 */
export const GGData = (props: GGDataProps): LiveElement => {
  const frame = useMemo(
    () =>
      // A frame holding resident columns is already mounted; anything else
      // goes through ingest (an ingested frame passes through by identity).
      Object.values(props.data as Record<string, unknown>).some((c) =>
          isResidentColumn(c as MountedColumn)
        )
        ? props.data as MountedDataFrame
        : ingest(props.data as InputData) as MountedDataFrame,
    [props.data],
  );
  const names = props.columns ?? Object.keys(frame);
  return capture<MountedReport | null>(
    ColumnCapture,
    names.filter((name) => frame[name]).map((name) =>
      createElement(MountColumn, { key: name, name, column: frame[name] })
    ),
    (reports) => createElement(ProvideData, { frame, reports, props }),
  );
};

/** The capture continuation: one stable context value per set of sources. */
const ProvideData = (
  { frame, reports, props }: {
    frame: MountedDataFrame;
    reports: (MountedReport | null)[];
    props: GGDataProps;
  },
): LiveElement => {
  const stable = useMemo(() => reports, reports);
  const value = useMemo((): GGDataValue => {
    const columns: Record<string, GGDataColumn> = {};
    for (const report of stable) {
      if (report) columns[report.name] = report.column;
    }
    return { frame, columns };
  }, [frame, stable]);
  return provide(GGDataContext, value, props.children as LiveElement);
};
