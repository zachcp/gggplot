// Runtime resident-product registry — the live-backend resolver for the generic
// "ResidentProduct" RenderNode. The RenderTree stays fully serializable: it
// carries only a product id string; this map turns that id (plus the node's
// `view` flag) back into a concrete UseGPU Live component.
//
// This is a plain Record<string, ...> rather than the plan/registry.ts
// ExtensionRegistry: that class couples resolution to full ExtensionDefinition
// validation, capability-declaration matching, and structuredClone
// serializability checks — machinery meant for host-registered portable-spec
// extensions, and overkill for an internal product → component lookup. The bead
// explicitly permits a simple runtime map when the extension adapter shape does
// not fit without contortion; it does not, so we use the map.
import {
  RESIDENT_STAT_BIN_PRODUCT,
  RESIDENT_STAT_BIN_TILES_PRODUCT,
  RESIDENT_STAT_COUNT_PRODUCT,
} from "../compile/resident.ts";
import { ResidentCountMark } from "./resident_count_live.tsx";
import { ResidentCountView } from "./resident_count_view.tsx";
import { ResidentHistogramMark } from "./resident_live.tsx";
import { ResidentHistogramView } from "./resident_view.tsx";
import { ResidentTileMark } from "./resident_tile_live.tsx";
import { ResidentTileView } from "./resident_tile_view.tsx";

/** A UseGPU Live component: props in, LiveElement out (kept opaque to core). */
export type LiveComponent = (props: Record<string, unknown>) => unknown;

export interface ResidentProductComponents {
  /** Inline mark form (mounted inside a panel's view). */
  mark: LiveComponent;
  /** Standalone auto-y-domain "view" form, when the product supports one. */
  view?: LiveComponent;
}

/**
 * Product id → live components. Seeded with the histogram mark/view; new
 * resident products register here instead of adding ComponentName variants.
 */
export const RESIDENT_PRODUCT_REGISTRY: Record<
  string,
  ResidentProductComponents
> = {
  [RESIDENT_STAT_BIN_PRODUCT]: {
    mark: ResidentHistogramMark as unknown as LiveComponent,
    view: ResidentHistogramView as unknown as LiveComponent,
  },
  [RESIDENT_STAT_COUNT_PRODUCT]: {
    mark: ResidentCountMark as unknown as LiveComponent,
    view: ResidentCountView as unknown as LiveComponent,
  },
  // Dense [group, bin] heatmap strip over the same stat_bin grid; the tile
  // geom's residentPlan only emits the standalone view form (its y range is
  // the group-row count, owned by the view). Per-count color shading (a
  // continuous fill field from the resident counts buffer) is the natural
  // follow-up once shader-accessible scales exist; today rows take their
  // group's palette color or the single scalar fill.
  [RESIDENT_STAT_BIN_TILES_PRODUCT]: {
    mark: ResidentTileMark as unknown as LiveComponent,
    view: ResidentTileView as unknown as LiveComponent,
  },
};

/** Resolve a ResidentProduct node's `product`/`view` to its live component. */
export function resolveResidentProduct(
  product: string,
  view: boolean,
): LiveComponent {
  const entry = RESIDENT_PRODUCT_REGISTRY[product];
  if (!entry) {
    throw new Error(
      `[gggplot] no resident product registered for "${product}"`,
    );
  }
  const component = view ? entry.view : entry.mark;
  if (!component) {
    throw new Error(
      `[gggplot] resident product "${product}" has no ${
        view ? "view" : "mark"
      } component`,
    );
  }
  return component;
}
