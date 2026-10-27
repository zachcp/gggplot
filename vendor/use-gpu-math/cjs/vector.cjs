"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Vector", {
    enumerable: true,
    get: function() {
        return Vector;
    }
});
// Binary dot-like operator
const binary = (f)=>(a, b)=>{
        const { length } = a;
        const c = a.slice();
        for(let i = 0; i < length; ++i){
            c[i] = f(a[i], b[i]);
        }
        return c;
    };
// Unary reduction operator
const reduce = (f)=>(v, accum = 0)=>{
        const { length } = v;
        for(let i = 0; i < length; ++i){
            accum = f(accum, v[i], i);
        }
        return accum;
    };
// Binary reduction operator
const reduce2 = (f)=>(a, b, accum = 0)=>{
        const { length } = a;
        for(let i = 0; i < length; ++i){
            accum = f(accum, a[i], b[i], i);
        }
        return accum;
    };
// Scalar operators
const plus = (x, y)=>x + y;
const minus = (x, y)=>x - y;
const multiply = (x, y)=>x * y;
const divide = (x, y)=>x / y;
const minimum = (x, y)=>Math.min(x, y);
const maximum = (x, y)=>Math.max(x, y);
const plus2 = (x, y)=>x + y * y;
const mad = (x, y, z)=>x + y * z;
const madl2 = (x, y, z)=>x + (y - z) * (y - z);
// Vector operators
const add = binary(plus);
const sub = binary(minus);
const mul = binary(multiply);
const div = binary(divide);
const dot = reduce2(mad);
const adds = (a, s)=>a.map((x)=>x + s);
const subs = (a, s)=>a.map((x)=>x - s);
const muls = (a, s)=>a.map((x)=>x * s);
const scale = muls;
const sum = reduce(plus);
const len2 = reduce(plus2);
const len = (a)=>Math.sqrt(len2(a));
const dist2 = reduce2(madl2);
const dist = (a, b)=>Math.sqrt(dist2(a, b));
const abs = (a)=>a.map((x)=>Math.abs(x));
const unit = (a)=>{
    const l = len(a);
    return scale(a, l ? 1 / l : 0);
};
const minEl = (a)=>reduce(minimum)(a, Infinity);
const maxEl = (a)=>reduce(maximum)(a, -Infinity);
const min = (a, b)=>a.map((_, i)=>Math.min(a[i], b[i]));
const max = (a, b)=>a.map((_, i)=>Math.max(a[i], b[i]));
const clamp = (vector, a = 0, b = 1)=>vector.map((v)=>Math.max(a, Math.min(b, v)));
const mins = (a, b)=>a.map((_, i)=>Math.min(a[i], b));
const maxs = (a, b)=>a.map((_, i)=>Math.max(a[i], b));
const lerp = (a, b, t)=>add(a, scale(sub(b, a), t));
const project = (a, n)=>sub(a, scale(n, dot(a, n)));
const select = (a, b, m)=>m.map((s, i)=>s ? b[i] : a[i]);
const Vector = {
    binary,
    reduce,
    reduce2,
    add,
    sub,
    mul,
    div,
    dot,
    adds,
    subs,
    muls,
    mins,
    maxs,
    scale,
    sum,
    len2,
    len,
    dist2,
    dist,
    abs,
    unit,
    minEl,
    maxEl,
    min,
    max,
    clamp,
    lerp,
    project,
    select
};

//# sourceMappingURL=vector.js.map