// Identity for inline JSX props: a component re-rendered with equal props gets
// the previous object back, so memos keyed on it do not rerun.
import { useOne } from "../runtime/usegpu_compat.ts";

/** Equal by identity, or arrays / plain objects equal one level deep. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (
    a && b && typeof a === "object" && typeof b === "object" &&
    Object.getPrototypeOf(a) === Object.prototype &&
    Object.getPrototypeOf(b) === Object.prototype
  ) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length &&
      ka.every((k) =>
        (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]
      );
  }
  return false;
}

/**
 * Returns `value` unless every entry equals the previous value's (by
 * `sameValue`), in which case the previous object comes back.
 */
export function useStableProps<T extends Record<string, unknown>>(
  value: T,
): T {
  const ref = useOne(() => ({ current: value }));
  const prev = ref.current;
  const keys = Object.keys(value);
  const same = keys.length === Object.keys(prev).length &&
    keys.every((k) => sameValue(prev[k], value[k]));
  if (!same) ref.current = value;
  return ref.current;
}
