/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getIndex u32 export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(1),[Z]:_([2]),[P]:[{[N]:"i",[T]:_(1)}]}}]};
const data = {
  name: "instance/identity",
  code: _(["@",2," fn ",0,"(i:u32)->u32{return i;}\n"]).join(''),
  hash: 0x1004e03cd8baf5,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,42],[1,0,7],[2,11,19]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getIndex = getSymbol("getIndex");
//# sourceMappingURL=identity.wgsl.js.map
