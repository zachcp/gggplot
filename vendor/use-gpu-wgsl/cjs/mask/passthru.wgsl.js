/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getPassThruColor export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([1]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}]}}]};
const data = {
  name: "mask/passthru",
  code: _(["@",1," fn ",0,"(c:",C,",u:",C,",s:",C,")->",C,"{if(HAS_ALPHA_TO_COVERAGE){return ",C,"(c.xyz,c.a);}else{return ",C,"(c.xyz*c.a,c.a);}}\n"]).join(''),
  hash: 0x423e9cd5d291f,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,170],[1,0,7],[2,11,27]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getPassThruColor = getSymbol("getPassThruColor");
//# sourceMappingURL=passthru.wgsl.js.map
