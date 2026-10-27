/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("displayStencil export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([1]),[P]:[{[N]:"s",[T]:C}]}}]};
const data = {
  name: "display/stencil",
  code: _(["@",1," fn ",0,"(s:",C,")->",C,"{let s1=s.x;let a=(s1)% 1.0;let b=(s1*4.0)% 1.0;let c=(s1*16.0)% 1.0;return sqrt(",C,"(a,c,b,1.0));}\n"]).join(''),
  hash: 0x1215cd3b247f2f,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,153],[1,0,7],[2,11,25]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.displayStencil = getSymbol("displayStencil");
//# sourceMappingURL=stencil.wgsl.js.map
