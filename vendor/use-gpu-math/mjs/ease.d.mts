export declare const cubicBezier: (t: number, a: number, b: number, c: number, d: number) => number;
export declare const cubicBezierDt: (t: number, a: number, b: number, c: number, d: number) => number;
export declare const cubicBezierDt2: (t: number, a: number, b: number, c: number, d: number) => number;
export declare const cubicBezier01: (t: number, b: number, c: number) => number;
export declare const cubicBezierInverse01: (v: number, b: number, c: number) => number;
export declare const bezierEase: (t: number, x1: number, y1: number, x2: number, y2: number) => number;
export declare const velocityToBezierEase: (duration: number, arcLength: number, v1: number, v2: number, w1?: number, w2?: number) => number[];
export declare const catmullRom: (t: number, t0: number, t1: number, t2: number, t3: number, a: number, b: number, c: number, d: number) => number;
export declare const catmullRomDual: (t: number, t0: number, t1: number, t2: number, t3: number, a: number, b: number, c: number, d: number) => [number, number];
export declare const catmullRomWeighted: (fraction: number, a: number, b: number, c: number, d: number, ab: number, bc: number, cd: number, power?: number) => number;
export declare const catmullRomWeightedDual: (fraction: number, a: number, b: number, c: number, d: number, ab: number, bc: number, cd: number, power?: number) => [number, number];
export declare const sampleToCubicBezier: (sampleDual: (t: number) => [number, number]) => number[];
export type ArcLengthMap = {
    map: Float32Array;
    count: number;
    length: number;
    limit: number;
};
export declare const makeArcLengthMap: (measure: (t1: number, t2: number) => number, tolerance?: number, evenness?: number, limit?: number) => {
    map: Float32Array<ArrayBuffer>;
    count: number;
    length: number;
    limit: number;
};
export declare const queryArcLengthMap: (am: ArcLengthMap, value: number) => number;
