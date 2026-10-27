/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("PrintData export vertex atomic<u32> vector vectors array<vec4<f32>>".split(' '));
const table = {[Y]:_([0]),[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[U]:{[N]:_(0),[Z]:_([1]),[M]:[{[N]:_(2),[T]:_(3)},{[N]:_(4),[T]:_(3)},{[N]:_(5),[T]:_(6)}]}}]};
const data = {
  name: "debug/print",
  code: _(["@",1," ",U," ",0,"{",2,":",3,",",4,":",3,",",4,"s:",6,",};\n"]).join(''),
  hash: 0x868ba4a72ae49,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,89],[1,0,7],[2,15,24]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.PrintData = getSymbol("PrintData");
//# sourceMappingURL=print.wgsl.js.map
