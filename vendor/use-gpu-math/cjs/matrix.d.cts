export declare const Matrix: {
    dims: (m: number[][]) => number[];
    fill: (n: number, m: number, f?: (i: number, j: number) => number) => number[][];
    identity: (n: number) => number[][];
    add: (a: number[][], b: number[][]) => number[][];
    sub: (a: number[][], b: number[][]) => number[][];
    mul: (a: number[][], b: number[][]) => number[][];
    muls: (a: number[][], s: number) => number[][];
    tmul: (a: number[][], b: number[][]) => number[][];
    transpose: (x: number[][]) => number[][];
    concat: (a: number[][], b: number[] | number[][]) => number[][];
    slice: (M: number[][], a: number, b: number, c: number, d: number) => number[][];
    rank: (A: number[][]) => number;
    norm: (x: number[][]) => number;
    norm2: (x: number[][]) => number;
    determinant: (x: number[][]) => number;
    jordanNormal: (x: number[][]) => number[][];
};
