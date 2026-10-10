// Keep unchanged mark data at its previous identity across a re-lower.
//
// Use.GPU's raw sources re-upload when a typed array's IDENTITY changes, not
// its contents (see render/gpu_instrument.ts's spiked entry points). Lowering a
// layer again builds fresh typed arrays even where nothing changed, e.g. a
// fixed-color change re-packs positions that are byte-identical. Running the
// new marks through reuseUnchanged against the previous marks hands back the
// previous object wherever the bytes match, so only what actually changed is
// uploaded. The component path (gggplot-vnh.3) uses this per layer in place of
// the whole-plot pack cache.

type TypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array;

function isTypedArray(value: unknown): value is TypedArray {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function sameBytes(a: TypedArray, b: TypedArray): boolean {
  if (a.constructor !== b.constructor || a.length !== b.length) return false;
  const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Return `prev` wherever `next` is deep-equal to it, else `next` with every
 * equal part replaced by its `prev` counterpart.
 *
 * Typed arrays compare by bytes, plain objects and arrays structurally, and
 * everything else with Object.is. Class instances and functions are never
 * descended into. Equal results are identical (`===`) to `prev`, so a caller
 * can test the return value to see whether anything changed; a part with
 * nothing to reuse comes back as `next` itself.
 */
export function reuseUnchanged<T>(next: T, prev: unknown): T {
  if (Object.is(next, prev)) return next;
  if (isTypedArray(next)) {
    return isTypedArray(prev) && sameBytes(next, prev) ? prev as T : next;
  }
  if (Array.isArray(next)) {
    if (!Array.isArray(prev)) return next;
    let same = next.length === prev.length;
    let reused = false;
    const out = next.map((item, i) => {
      const kept = reuseUnchanged(item, prev[i]);
      if (kept !== prev[i]) same = false;
      if (kept !== item) reused = true;
      return kept;
    });
    return (same ? prev : reused ? out : next) as T;
  }
  if (isPlainObject(next)) {
    if (!isPlainObject(prev)) return next;
    const keys = Object.keys(next);
    let same = keys.length === Object.keys(prev).length;
    let reused = false;
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      const kept = reuseUnchanged(next[key], prev[key]);
      if (kept !== prev[key] || !(key in prev)) same = false;
      if (kept !== next[key]) reused = true;
      out[key] = kept;
    }
    return (same ? prev : reused ? out : next) as T;
  }
  return next;
}
