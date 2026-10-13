const { max } = Math;
export const π = Math.PI;
export const τ = 2 * π;
export const clamp = (x, a, b)=>max(a, Math.min(b, x));
export const cub = (x)=>x * x * x;
export const sqr = (x)=>x * x;
export const lerp = (a, b, t)=>a * (1 - t) + b * t;
export const clerp = (a, b, t)=>{
    const d = (b - a + π) / τ % 1 * τ - π;
    return lerp(a, a + d, t);
};
export const seq = (n, start = 0, step = 1)=>Array.from({
        length: n
    }).map((_, i)=>start + i * step);

//# sourceMappingURL=math.js.map