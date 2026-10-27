import { π, clamp, sqr } from './number.mjs';
const { abs, acos, cbrt, ceil, cos, log2, min, pow, sign, sqrt } = Math;
// Cubic bezier 1D
export const cubicBezier = (t, a, b, c, d)=>(a + (3 * b - a) * t) * sqr(1 - t) + (d + (3 * c - d) * (1 - t)) * sqr(t);
// Cubic bezier 1D derivative
export const cubicBezierDt = (t, a, b, c, d)=>a * (-3 * sqr(1 - t)) + b * ((9 * t - 12) * t + 3) + c * (6 - 9 * t) * t + d * 3 * sqr(t);
// Cubic bezier 1D 2nd derivative
export const cubicBezierDt2 = (t, a, b, c, d)=>a * (3 * 2 * (1 - t)) + b * (18 * t - 12) + c * (6 - 18 * t) + d * 3 * 2 * t;
// Cubic bezier 1D (a=0 d=1)
export const cubicBezier01 = (t, b, c)=>3 * b * t * sqr(1 - t) + (3 * c * (1 - t) + t) * sqr(t);
// Invert monotonous cubic bezier (a=0 d=1) (analytic)
export const cubicBezierInverse01 = (v, b, c)=>{
    // Bezier over x=[-1..1] y=[-1..1] with symmetric basis functions
    const y = v * 2 - 1;
    // Sum and difference of middle two bezier bands relative to f(x) = x
    const s = 3 / 4 * (b + c - 1);
    const d = 3 / 4 * (b - c + 1 / 3);
    if (abs(d) < 1e-5) {
        if (abs(s) < 1e-5) return v;
        return solveQuadraticBezier(s, y) * .5 + .5;
    }
    // Construct cubic basis
    // y = (d x^3 - s x^2 - d x + s) + x
    // Deflate cubic
    // t = x - o
    // t^3 + pt + q = 0
    const id = 1 / d;
    const s2 = s * s;
    const d2 = d * d;
    const id2 = id * id;
    const o = 1 / 3 * s * id;
    const p = (d - d2 + -1 / 3 * s2) * id2;
    const q = ((-2 / 27 * s2 + 1 / 3 * (d - d2) + d2) * s - y * d2) * (id2 * id);
    return (solveDepressedCubicBezier(p, q, s, d) + o) * .5 + .5;
};
// Helper for quadratic inverse (d=0)
const solveQuadraticBezier = (s, y)=>{
    const d = 1 - 4 * s * (y - s);
    const v = (1 - sqrt(d)) / (2 * s);
    return v;
};
// Helper for cubic inverse, solve depressed cubic p/q using s/d to pick roots
const solveDepressedCubicBezier = (p, q, s, d)=>{
    const p_3 = p / 3;
    const q_2 = q / 2;
    const p3_27 = p_3 * p_3 * p_3;
    const ds = p3_27 + q_2 * q_2;
    if (ds === 0) {
        // Multiple root
        if (p) return -q_2 / p_3;
        else return 0;
    } else if (ds > 0) {
        // Vieta's substitution. Pick matching sign for better precision.
        const w = -q_2 - sqrt(ds) * sign(q);
        const cw = cbrt(w);
        return cw - p_3 / cw;
    } else {
        // Imaginary sqrt(ds)
        const dp = sqrt(-p3_27);
        const theta = acos(-q_2 / dp) / 3;
        const cw = cbrt(dp);
        const r = cw - p_3 / cw;
        const i = +(d < 0) || +(s * d > 0) * 2;
        const cc = cos(theta - i * (2 / 3) * π);
        const v = cc * r;
        return v;
    }
};
// Cubic bezier ease, X = time / Y = value
// Only control points (x1,y1) and (x2,y2) are adjustable (x = [0...1], y = any)
export const bezierEase = (t, x1, y1, x2, y2)=>{
    if (t === 0 || t === 1) return t;
    const s = cubicBezierInverse01(t, x1, x2);
    const value = cubicBezier01(s, y1, y2);
    return value;
};
// Velocity helper for cubic bezier ease.
// Ease across arcLength over duration, entering at speed v1 and exiting at speed v2.
export const velocityToBezierEase = (duration, arcLength, v1, v2, w1 = 1 / 3, w2 = 1 / 3)=>{
    const slope1 = arcLength ? v1 * duration / arcLength : 0;
    const slope2 = arcLength ? v2 * duration / arcLength : 0;
    const x1 = min(w1, 1 / slope1);
    const x2 = min(w2, 1 / slope2);
    const y1 = x1 * slope1;
    const y2 = x2 * slope2;
    return [
        x1,
        y1,
        1 - x2,
        1 - y2
    ];
};
// Catmull-rom spline with movable knots
export const catmullRom = (t, t0, t1, t2, t3, a, b, c, d)=>{
    const d0t = t0 - t;
    const d10 = t1 - t0;
    const d1t = t1 - t;
    const d20 = t2 - t0;
    const d21 = t2 - t1;
    const d2t = t2 - t;
    const d31 = t3 - t1;
    const d32 = t3 - t2;
    const d3t = t3 - t;
    const a1 = d10 !== 0 ? a * (d1t / d10) + b * (-d0t / d10) : (a + b) / 2;
    const a2 = d21 !== 0 ? b * (d2t / d21) + c * (-d1t / d21) : (b + c) / 2;
    const a3 = d32 !== 0 ? c * (d3t / d32) + d * (-d2t / d32) : (c + d) / 2;
    const b1 = d20 !== 0 ? a1 * (d2t / d20) + a2 * (-d0t / d20) : (a1 + a2) / 2;
    const b2 = d31 !== 0 ? a2 * (d3t / d31) + a3 * (-d1t / d31) : (a2 + a3) / 2;
    const v = d21 !== 0 ? b1 * (d2t / d21) + b2 * (-d1t / d21) : (b1 + b2) / 2;
    return v;
};
// Catmull-rom spline value+derivative with movable knots
export const catmullRomDual = (t, t0, t1, t2, t3, a, b, c, d)=>{
    const d0t = t0 - t;
    const d10 = t1 - t0;
    const d1t = t1 - t;
    const d20 = t2 - t0;
    const d21 = t2 - t1;
    const d2t = t2 - t;
    const d31 = t3 - t1;
    const d32 = t3 - t2;
    const d3t = t3 - t;
    const a1 = d10 !== 0 ? a * (d1t / d10) + b * (-d0t / d10) : (a + b) / 2;
    const a2 = d21 !== 0 ? b * (d2t / d21) + c * (-d1t / d21) : (b + c) / 2;
    const a3 = d32 !== 0 ? c * (d3t / d32) + d * (-d2t / d32) : (c + d) / 2;
    const b1 = d20 !== 0 ? a1 * (d2t / d20) + a2 * (-d0t / d20) : (a1 + a2) / 2;
    const b2 = d31 !== 0 ? a2 * (d3t / d31) + a3 * (-d1t / d31) : (a2 + a3) / 2;
    const v = d21 !== 0 ? b1 * (d2t / d21) + b2 * (-d1t / d21) : (b1 + b2) / 2;
    const da1dt = d10 !== 0 ? a * (-1 / d10) + b * (1 / d10) : 0;
    const da2dt = d21 !== 0 ? b * (-1 / d21) + c * (1 / d21) : 0;
    const da3dt = d32 !== 0 ? c * (-1 / d32) + d * (1 / d32) : 0;
    const db1dt = d20 !== 0 ? a1 * (-1 / d20) + da1dt * (d2t / d20) + a2 * (1 / d20) + da2dt * (-d0t / d20) : 0;
    const db2dt = d31 !== 0 ? a2 * (-1 / d31) + da2dt * (d3t / d31) + a3 * (1 / d31) + da3dt * (-d1t / d31) : 0;
    const dvdt = d21 !== 0 ? b1 * (-1 / d21) + db1dt * (d2t / d21) + b2 * (1 / d21) + db2dt * (-d1t / d21) : 0;
    return [
        v,
        dvdt
    ];
};
// Weighted catmull rom (chordal = 1, centripetal = 1/2)
export const catmullRomWeighted = (fraction, a, b, c, d, ab, bc, cd, power = 1 / 2)=>{
    const d1 = pow(ab, power);
    const d2 = pow(bc, power);
    const d3 = pow(cd, power);
    const t0 = -d1;
    const t1 = 0;
    const t2 = d2;
    const t3 = d2 + d3;
    return catmullRom(fraction * d2, t0, t1, t2, t3, a, b, c, d);
};
// Weighted catmull rom value+derivative (chordal = 1, centripetal = 1/2)
export const catmullRomWeightedDual = (fraction, a, b, c, d, ab, bc, cd, power = 1 / 2)=>{
    const d1 = pow(ab, power);
    const d2 = pow(bc, power);
    const d3 = pow(cd, power);
    const t0 = -d1;
    const t1 = 0;
    const t2 = d2;
    const t3 = d2 + d3;
    const [v, dvdt] = catmullRomDual(fraction * d2, t0, t1, t2, t3, a, b, c, d);
    return [
        v,
        dvdt * d2
    ];
};
// Sample spline at endpoints (0..1) to make cubic bezier
export const sampleToCubicBezier = (sampleDual)=>{
    const [b0, v0] = sampleDual(0);
    const [b3, v3] = sampleDual(1);
    const b1 = b0 + v0 / 3;
    const b2 = b3 - v3 / 3;
    return [
        b0,
        b1,
        b2,
        b3
    ];
};
// Make arc length map for a spline
export const makeArcLengthMap = (measure, tolerance = 0.005, evenness = 0.5, limit = 8)=>{
    let n = 0;
    let accum = 0;
    const eps = pow(2, ceil(log2(tolerance)));
    // Extra epsilon at start
    const data = [
        -measure(-eps, 0),
        -eps,
        0
    ];
    // Accumulate samples from 0..1
    const range = (a, b, l, force, limit)=>{
        const m = (a + b) / 2;
        const l1 = measure(a, m);
        const l2 = measure(m, b);
        const d = l1 + l2;
        const e = min(l1 / l2, l2 / l1);
        if ((force > 0 || l / d < 1 - tolerance || e < evenness) && limit > 0) {
            range(a, m, l1, force - 1, limit - 1);
            range(m, b, l2, force - 1, limit - 1);
        } else {
            n++;
            const r = l / d;
            accum += d / (1 + r) * 2;
            data.push(a);
            data.push(accum);
        }
    };
    range(0, 1, measure(0, 1), 2, limit);
    data.push(1);
    // Extra epsilon at end
    data.push(accum + measure(1, 1 + eps));
    data.push(1 + eps);
    const count = n;
    const length = accum;
    const map = new Float32Array(data);
    return {
        map,
        count,
        length,
        limit
    };
};
// Query value in arc length map
export const queryArcLengthMap = (am, value)=>{
    const { map, count } = am;
    let { limit } = am;
    let a = 1;
    let b = count;
    while(b > a && limit-- > 0){
        const m = b - (b - a >> 1);
        const d = map[m * 2];
        if (d > value) b = m - 1;
        else a = m;
    }
    const a2 = a * 2;
    const d0 = map[a2 - 2];
    const t0 = map[a2 - 1];
    const d1 = map[a2];
    const t1 = map[a2 + 1];
    const d2 = map[a2 + 2];
    const t2 = map[a2 + 3];
    const d3 = map[a2 + 4];
    const t3 = map[a2 + 5];
    return clamp(catmullRom(value, d0, d1, d2, d3, t0, t1, t2, t3), 0, 1);
};

//# sourceMappingURL=ease.js.map