"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get solveCubic () {
        return solveCubic;
    },
    get solveDepressedCubic () {
        return solveDepressedCubic;
    },
    get solveDepressedQuartic () {
        return solveDepressedQuartic;
    },
    get solveQuadratic () {
        return solveQuadratic;
    },
    get solveQuartic () {
        return solveQuartic;
    }
});
const _number = require("./number.cjs");
const { acos, cbrt, cos, sign, sqrt } = Math;
const solveQuadratic = (a, b, c)=>{
    const d = b * b - 4 * a * c;
    if (d < 0) return [];
    if (d === 0) return [
        -b / (2 * a)
    ];
    const x1 = (-b - sqrt(d)) / (2 * a);
    const x2 = (-b + sqrt(d)) / (2 * a);
    return [
        x1,
        x2
    ];
};
const solveCubic = (a, b, c, d)=>{
    const o = -b / (3 * a);
    const p = (3 * a * c - b * b) / (3 * a * a);
    const q = (2 * b * b * b - 9 * a * b * c + 27 * a * a * d) / (27 * a * a * a);
    return solveDepressedCubic(p, q).map((x)=>x + o);
};
const solveDepressedCubic = (p, q)=>{
    const p_3 = p / 3;
    const q_2 = q / 2;
    const p3_27 = (0, _number.cub)(p_3);
    const ds = p3_27 + (0, _number.sqr)(q_2);
    if (ds === 0) {
        // Multiple root
        if (p) {
            // Double root
            const r1 = q / p_3;
            const r2 = -q_2 / p_3;
            return [
                r1,
                r2
            ];
        } else {
            return [
                0
            ];
        }
    } else if (ds > 0) {
        // Single real root
        // Vieta's substitution. Pick matching sign for better precision.
        const w = -q_2 - sqrt(ds) * sign(q);
        const cw = cbrt(w);
        return [
            cw - p_3 / cw
        ];
    } else {
        // Three distinct real roots
        // Imaginary sqrt(ds)
        const dp = sqrt(-p3_27);
        const theta = acos(-q_2 / dp) / 3;
        const cw = cbrt(dp);
        const r = cw - p_3 / cw;
        const rs = [];
        for(let i = 0; i < 3; ++i){
            const cc = cos(theta - i * (2 / 3) * _number.π);
            const v = cc * r;
            rs.push(v);
        }
        return rs;
    }
};
const solveQuartic = (a, b, c, d, e)=>{
    const o = -b / (4 * a);
    const aa = -3 * (0, _number.sqr)(b) / (8 * (0, _number.sqr)(a)) + c / a;
    const bb = (0, _number.cub)(b) / (8 * (0, _number.cub)(a)) - b * c / (2 * (0, _number.sqr)(a)) + d / a;
    const cc = -3 * (0, _number.sqr)((0, _number.sqr)(b)) / (256 * (0, _number.sqr)((0, _number.sqr)(a))) + c * (0, _number.sqr)(b) / (16 * (0, _number.cub)(a)) - b * d / (4 * (0, _number.sqr)(a)) + e / a;
    if (bb === 0) {
        // Biquadratic case
        const q = solveQuadratic(1, aa, cc);
        if (!q.length) return q;
        const solutions = [];
        const [q1, q2] = q;
        if (q1 > 0) {
            solutions.push(sqrt(q1) + o);
            solutions.push(-sqrt(q1) + o);
        }
        if (q2 > 0) {
            solutions.push(sqrt(q2) + o);
            solutions.push(-sqrt(q2) + o);
        }
        if (q1 === 0) {
            solutions.push(o);
        }
        if (q2 === 0) {
            solutions.push(o);
        }
        return solutions;
    }
    // Quartic case
    return solveDepressedQuartic(aa, bb, cc).map((x)=>x + o);
};
const solveDepressedQuartic = (a, b, c)=>{
    const p = -(0, _number.sqr)(a) / 12 - c;
    const q = -(0, _number.cub)(a) / 108 + a * c / 3 - (0, _number.sqr)(b) / 8;
    const q_2 = q / 2;
    const p_3 = p / 3;
    const p3_27 = (0, _number.cub)(p_3);
    const ds = p3_27 + (0, _number.sqr)(q_2);
    const solutions = [];
    let y = -Infinity;
    if (ds >= 0) {
        // Real R
        const r = -q_2 - sqrt(ds) * sign(ds);
        const u = cbrt(r);
        y = -5 / 6 * a + (u ? u - p / (3 * u) : -cbrt(q));
    } else {
        // Complex R
        const dp = sqrt(-p3_27);
        const theta = acos(-q_2 / dp) / 3;
        const ct = cos(theta);
        const ul = cbrt(dp);
        // U - P/(3U) is always real
        y = -5 / 6 * a + (ul ? ct * (ul - p_3 / ul) : -cbrt(q));
    }
    const w2 = a + 2 * y;
    const w = sqrt(w2);
    if (w2 < 0) {
        return solutions;
    }
    const qw1 = -(3 * a + 2 * y + 2 * b / w);
    const qw2 = -(3 * a + 2 * y - 2 * b / w);
    if (qw1 > 0) {
        const t1 = (w + sqrt(qw1)) / 2;
        const t2 = (w - sqrt(qw1)) / 2;
        solutions.push(t1, t2);
    }
    if (qw1 === 0) {
        solutions.push(w / 2);
    }
    if (qw2 > 0) {
        const t3 = (-w + sqrt(qw2)) / 2;
        const t4 = (-w - sqrt(qw2)) / 2;
        if (!solutions.includes(t3)) solutions.push(t3);
        if (!solutions.includes(t4)) solutions.push(t4);
    }
    if (qw2 === 0) {
        const t = -w / 2;
        if (!solutions.includes(t)) solutions.push(t);
    }
    return solutions;
};

//# sourceMappingURL=polynomial.js.map