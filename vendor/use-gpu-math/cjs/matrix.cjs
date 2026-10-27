"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Matrix", {
    enumerable: true,
    get: function() {
        return Matrix;
    }
});
const _number = require("./number.cjs");
const { sqrt } = Math;
// Get matrix dimensions
const dims = (m)=>[
        m.length,
        m[0].length
    ];
const size = ([a, b])=>`${a}x${b}`;
// Fill an NxM matrix using a given expression
const fill = (n, m, f = ()=>0)=>{
    const out = [];
    for(let j = 0; j < n; ++j){
        const row = [];
        for(let i = 0; i < m; ++i){
            row[i] = f(i, j);
        }
        out.push(row);
    }
    return out;
};
// Identity matrix
const identity = (n)=>fill(n, n, (i, j)=>+(i == j));
// Add two matrices
const add = (a, b)=>{
    const [na, ma] = dims(a);
    const [nb, mb] = dims(b);
    if (ma !== mb || na !== nb) {
        console.error("Incompatible matrices", a, b, size(dims(a)), size(dims(b)));
        throw new Error("Matrix error");
    }
    return fill(na, ma, (i, j)=>a[j][i] + b[j][i]);
};
// Subtract two matrices
const sub = (a, b)=>{
    const [na, ma] = dims(a);
    const [nb, mb] = dims(b);
    if (ma !== mb || na !== nb) {
        console.error("Incompatible matrices", a, b, size(dims(a)), size(dims(b)));
        throw new Error("Matrix error");
    }
    return fill(na, ma, (i, j)=>a[j][i] - b[j][i]);
};
// Scale matrix by a scalar
const muls = (a, s)=>{
    const [na, ma] = dims(a);
    return fill(na, ma, (i, j)=>a[j][i] * s);
};
// Multiply two matrices
const mul = (a, b)=>{
    const [na, ma] = dims(a);
    const [nb, mb] = dims(b);
    if (ma !== nb) {
        console.error("Incompatible matrices", a, b, size(dims(a)), size(dims(b)));
        throw new Error("Matrix error");
    }
    return fill(na, mb, (i, j)=>{
        let v = 0;
        for(let k = 0; k < ma; ++k)v += a[j][k] * b[k][i];
        return v;
    });
};
// Multiply two matrices while transposing the second
const tmul = (a, b)=>{
    const [na, ma] = dims(a);
    const [nb, mb] = dims(b);
    if (ma !== mb) {
        console.error("Incompatible matrices", a, b, size(dims(a)), size(dims(b)));
        throw new Error("Matrix error");
    }
    return fill(na, nb, (i, j)=>{
        let v = 0;
        for(let k = 0; k < ma; ++k)v += a[j][k] * b[i][k];
        return v;
    });
};
// Transpose a matrix
const transpose = (x)=>{
    const [n, m] = dims(x);
    return fill(m, n, (i, j)=>x[i][j]);
};
// Concatenate two matrices horizontally
const concat = (a, b)=>{
    const [na] = dims(a);
    const nb = b.length;
    if (na !== nb) {
        console.error("Incompatible matrices", a, b, size(dims(a)), nb);
        throw "Matrix error";
    }
    return a.map((_, i)=>a[i].concat(b[i]));
};
// Extract a submatrix from index (a,b) to (c,d) exclusive
const slice = (M, a, b, c, d)=>{
    const [n, m] = dims(M);
    a = Math.min(a, m);
    b = Math.min(b, n);
    if (c === undefined) c = m;
    if (d === undefined) d = n;
    c = Math.max(a, Math.min(m, c < 0 ? m + c : c));
    d = Math.max(b, Math.min(n, d < 0 ? n + d : d));
    return fill(d - b, c - a, (i, j)=>M[j][i]);
};
// Get matrix rank
const rank = (A)=>{
    const G = jordanNormal(A);
    return diagonalRank(G);
};
// Calculate frobenius norm squared
const norm2 = (x)=>{
    const [n, m] = dims(x);
    let v = 0;
    for(let j = 0; j < m; ++j){
        for(let i = 0; i < n; ++i){
            v += (0, _number.sqr)(x[j][i]);
        }
    }
    return v;
};
// Calculate frobenius norm
const norm = (x)=>sqrt(norm2(x));
// Swap a later row to make (i,j) non-zero
const swapZero = (x, i, j)=>{
    const [n] = dims(x);
    for(let k = j + 1; k < n; ++k){
        if (x[k][i] !== 0) {
            [x[k], x[j]] = [
                x[j],
                x[k]
            ];
            return true;
        }
    }
    return false;
};
// In-place vector ops to spare the GC
// Scale a row by a constant
const scaleRow = (a, s)=>{
    const { length } = a;
    for(let i = 0; i < length; ++i)a[i] *= s;
};
// Multiply and add one row to another
const madRow = (a, b, s)=>{
    const { length } = a;
    for(let i = 0; i < length; ++i)a[i] += b[i] * s;
};
// Get determinant
const determinant = (x)=>{
    const [n, m] = dims(x);
    let offset = 0;
    x = structuredClone(x);
    let det = 1;
    for(let i = 0; i < Math.min(n, m); ++i){
        // Find next pivot element
        const pivot = x[i][i + offset];
        if (pivot == 0) {
            // Unsuitable, find other row to swap with
            if (!swapZero(x, i + offset, i)) {
                // All zeros, move one column over until out of bounds
                if (offset++ >= m - n) {
                    return 0;
                }
            }
            // Repeat iteration
            i--;
            continue;
        }
        // Scale pivot row
        scaleRow(x[i], 1 / pivot);
        det *= pivot;
        // Subtract from other rows
        for(let j = 0; j < n; ++j)if (i !== j) {
            const pivot = x[j][i + offset];
            madRow(x[j], x[i], -pivot);
        }
    }
    return det;
};
// Convert matrix into jordan normal form if possible
const jordanNormal = (x)=>{
    const [n, m] = dims(x);
    let offset = 0;
    // Don't modify argument
    x = structuredClone(x);
    for(let i = 0; i < Math.min(n, m); ++i){
        // Find next pivot element
        const pivot = x[i][i + offset];
        if (pivot == 0) {
            // Unsuitable, find other row to swap with
            if (!swapZero(x, i + offset, i)) {
                // All zeros, move one column over until out of bounds
                if (offset++ >= m - n) {
                    return x;
                }
            }
            // Repeat iteration
            i--;
            continue;
        }
        // Scale pivot row
        scaleRow(x[i], 1 / pivot);
        // Subtract from other rows
        for(let j = 0; j < n; ++j)if (i !== j) {
            const pivot = x[j][i + offset];
            madRow(x[j], x[i], -pivot);
        }
    }
    return x;
};
// Verify if matrix has uninterrupted non-zero diagonal
const diagonalRank = (x)=>{
    const [n, m] = dims(x);
    const l = Math.min(n, m);
    let i = 0;
    for(; i < l; ++i){
        if (x[i][i] == 0) break;
    }
    return i;
};
const Matrix = {
    dims,
    fill,
    identity,
    add,
    sub,
    mul,
    muls,
    tmul,
    transpose,
    concat,
    slice,
    rank,
    norm,
    norm2,
    determinant,
    jordanNormal
};

//# sourceMappingURL=matrix.js.map