/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("tonemapUnreal export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([1]),[P]:[{[N]:"c",[T]:C}]}}]};
const data = {
  name: "tonemap/unreal",
  code: _(["@",1," fn ",0,"(c:",C,")->",C,"{let r=c.rgb;return ",C,"(r/(r+0.155)*1.019,c.a);}\n"]).join(''),
  hash: 0x19188d29889d3c,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,102],[1,0,7],[2,11,24]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.tonemapUnreal = getSymbol("tonemapUnreal");
//# sourceMappingURL=unreal.wgsl.js.map
