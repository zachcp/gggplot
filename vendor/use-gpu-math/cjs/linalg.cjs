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
    get lagrangeMinimumTo () {
        return lagrangeMinimumTo;
    },
    get leastSquares () {
        return leastSquares;
    },
    get leastSquaresClosest () {
        return leastSquaresClosest;
    },
    get solveLinearSystem () {
        return solveLinearSystem;
    }
});
const _matrix = require("./matrix.cjs");
const _number = require("./number.cjs");
const { abs, min } = Math;
const { concat, dims, fill, jordanNormal, mul, transpose } = _matrix.Matrix;
// Fill an array of length n with all zeros except a single v at index i
const select = (n, i = n - 1, v = 1)=>(0, _number.seq)(n).map((j)=>i == j ? v : 0);
const solveLinearSystem = (A, B)=>{
    // eslint-disable-next-line
    let [n, m] = dims(A);
    // Diagonalize system of equations
    let G = jordanNormal(concat(A, B));
    // Filter out zero rows
    G = G.filter((row)=>row.filter((x)=>x).length > 0);
    n = G.length;
    if (n > m) {
        // Overdetermined, no solution
        return null;
    }
    if (!isJordanNormalDiagonal(G)) {
        // Underdetermined, no solution
        return null;
    }
    if (n == m) {
        // Extract exact solution
        const v = (0, _number.seq)(m).map((i)=>G[i][m]);
        return v;
    }
    return null;
};
const lagrangeMinimumTo = (A, B, P)=>{
    const [n, m] = dims(A);
    const M = concat(A, fill(n, n));
    const T = (0, _number.seq)(m).map((i)=>[
            ...select(m, i, 2),
            ...(0, _number.seq)(n).map((j)=>-A[j][i])
        ]);
    const AL = [
        ...M,
        ...T
    ];
    const BL = [
        ...B,
        ...P.map((v)=>2 * v)
    ];
    return [
        AL,
        BL
    ];
};
const leastSquares = (A, B)=>{
    const AT = transpose(A);
    const ATA = mul(AT, A);
    const ATB = mul([
        B
    ], A)[0];
    return [
        ATA,
        ATB
    ];
};
const leastSquaresClosest = (A, B, P)=>{
    const d = P.length;
    const AP = A.concat((0, _number.seq)(d).map((i)=>select(d, i)));
    const BP = B.concat(P);
    return leastSquares(AP, BP);
};
// Verify if matrix is jordan normal on the diagonal
const isJordanNormalDiagonal = (x)=>{
    const [n, m] = dims(x);
    const l = min(n, m);
    for(let i = 0; i < l; ++i){
        if (abs(x[i][i] - 1) > 1e-2) return false;
    }
    return true;
};

//# sourceMappingURL=linalg.js.map