/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("displayLogRGB mapLog export mapLog".split(' '));
const table = {[S]:_([0,1]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([2]),[P]:[{[N]:"s",[T]:C}],[I]:_([1])}}]};
const data = {
  name: "display/log-rgb",
  code: _(["@",2," fn ",0,"(s:",C,")->",C,"{return ",C,"(",1,"(s.r),",1,"(s.g),",1,"(s.b),1.0);}fn ",1,"(v:f32)->f32{let d=log(abs(v)+1.0);return fract(d/16.0);}\n"]).join(''),
  hash: 0x7601f6affdc5a,
  table,
  shake: [[0,[0]],[108,[1,0]]],
  tree: decompressAST([[0,0,108],[1,0,7],[2,11,24],[2,55,61],[2,12,18],[2,12,18],[0,18,84],[2,3,9]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.displayLogRGB = getSymbol("displayLogRGB");
//# sourceMappingURL=log-rgb.wgsl.js.map
