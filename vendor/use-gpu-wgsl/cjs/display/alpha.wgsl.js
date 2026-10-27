/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("displayAlpha export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([1]),[P]:[{[N]:"s",[T]:C}]}}]};
const data = {
  name: "display/alpha",
  code: _(["@",1," fn ",0,"(s:",C,")->",C,"{return ",C,"(",D,"(clamp(s.a,0.0,1.0)),1.0);};\n"]).join(''),
  hash: 0x1b124bfbe0c897,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,101],[1,0,7],[2,11,23]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.displayAlpha = getSymbol("displayAlpha");
//# sourceMappingURL=alpha.wgsl.js.map
