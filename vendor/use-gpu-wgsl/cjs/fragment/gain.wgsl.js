/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getGain gainColor f32 link export getGain".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3])}}],[E]:[{[A]:24,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([4]),[P]:[{[N]:"c",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "fragment/gain",
  code: _(["@",3," fn ",0,"()->f32;@",4," fn ",1,"(c:",C,")->",C,"{var r=c.rgb*",0,"();if(IS_OPAQUE){return ",C,"(r,1.0);}else{return ",C,"(r*",0,"(),c.a);}};\n"]).join(''),
  hash: 0x120a5ca3aaee50,
  table,
  shake: [[0,[0,1]],[24,[1]]],
  tree: decompressAST([[1,0,23],[0,24,171],[1,0,7],[2,11,20],[2,46,53],[2,73,80]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.gainColor = getSymbol("gainColor");
//# sourceMappingURL=gain.wgsl.js.map
