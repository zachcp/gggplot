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
    get clamp () {
        return clamp;
    },
    get clerp () {
        return clerp;
    },
    get cub () {
        return cub;
    },
    get lerp () {
        return lerp;
    },
    get seq () {
        return seq;
    },
    get sqr () {
        return sqr;
    },
    get π () {
        return π;
    },
    get τ () {
        return τ;
    }
});
const { max, min } = Math;
const π = Math.PI;
const τ = 2 * π;
const clamp = (x, a, b)=>max(a, min(b, x));
const cub = (x)=>x * x * x;
const sqr = (x)=>x * x;
const lerp = (a, b, t)=>a * (1 - t) + b * t;
const clerp = (a, b, t)=>{
    const d = (b - a + π) / τ % 1 * τ - π;
    return lerp(a, a + d, t);
};
const seq = (n, start = 0, step = 1)=>Array.from({
        length: n
    }).map((_, i)=>start + i * step);

//# sourceMappingURL=number.js.map