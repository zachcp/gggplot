/** @jsxRuntime classic */
/** @jsx createElement */
//
// Bridge from a live 3D scene's camera to the React host (gggplot-i5m.23).
//
// use.gpu's ViewContext carries pick(event) -> [origin, direction]: a
// world-space ray for a pointer position, derived from the CURRENT inverse
// projection-view matrix (workbench/hooks/useFrustumPicker.mjs). That matters
// more than it sounds — the ray has to follow the live orbit camera, so it
// cannot be computed once in the host and cached.
//
// The host cannot call useViewContext(): it is a live hook, valid only inside
// the use.gpu tree. So this component sits in the scene, reads the context, and
// writes the function into a ref the host owns. A ref rather than a callback
// deliberately: React holds the identity, there is no subscription to tear
// down, and a stale picker cannot outlive the scene that produced it.
import { useOne } from "@use-gpu/live";
import { useViewContext } from "@use-gpu/workbench";

/** A world-space ray: a point and a direction, both unnormalized. */
export interface SceneRay {
  origin: [number, number, number];
  direction: [number, number, number];
}

/** Normalized pointer position within the canvas, both in [0, 1]. */
export interface ScenePickPoint {
  u: number;
  v: number;
}

export type ScenePickFn = (point: ScenePickPoint) => SceneRay;

/**
 * Receives the scene's pointer-to-ray function, or null once it goes away.
 *
 * A FUNCTION, not a mutable ref object. live memoizes components and compares
 * props shallowly, and that comparison probes values with `'length' in value`;
 * a `{ current: null }` prop therefore throws "Cannot use 'in' operator to
 * search for 'length' in null" at mount. Functions compare by identity, so a
 * stable callback passes cleanly.
 */
export type ScenePickPublish = (pick: ScenePickFn | null) => void;

/**
 * Publish the scene's pointer-to-ray function to the host.
 *
 * Renders nothing. Mount it through GGPlot's sceneExtras, which places it
 * inside the panel's Cartesian node and therefore inside the 3D camera's
 * ViewContext — the flat overlay would resolve to the wrong camera.
 */
export const ScenePicker = ({ publish }: { publish: ScenePickPublish }) => {
  const view = useViewContext();
  const pick = view?.pick;
  useOne(() => {
    publish(
      pick == null ? null : (point: ScenePickPoint) => {
        // use.gpu's picker reads only u and v off the event object.
        const [origin, direction] = pick(
          point as unknown as Parameters<typeof pick>[0],
        );
        return {
          origin: [origin[0], origin[1], origin[2]] as [number, number, number],
          direction: [
            direction[0],
            direction[1],
            direction[2],
          ] as [number, number, number],
        };
      },
    );
  }, pick);
  return null;
};

/** Convert a DOM pointer position and the canvas rect into normalized u/v. */
export function pointerToUV(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): ScenePickPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    u: (clientX - rect.left) / rect.width,
    v: (clientY - rect.top) / rect.height,
  };
}
