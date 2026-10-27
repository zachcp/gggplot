/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("ACES_INPUT ACES_OUTPUT RRTAndODTFit tonemapACES export".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[E]:[{[A]:329,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([4]),[P]:[{[N]:"c",[T]:C}],[I]:_([0,2,1])}}]};
const data = {
  name: "tonemap/aces",
  code: _(["const ",0,"=mat3x3(0.59719,0.07600,0.02840,0.35458,0.90834,0.13383,0.04823,0.01566,0.83777);const ",1,"=mat3x3(1.60475,-0.10208,-0.00327,-0.53108,1.10813,-0.07276,-0.07367,-0.00605,1.07602,);fn ",2,"(v:",D,")->",D,"{let a=v*(v+0.0245786)-0.000090537;let b=v*(0.983729*v+0.4329510)+0.238081;return a/b;};@",4," fn ",3,"(c:",C,")->",C,"{var r=c.rgb;r=",0,"*r;r=",2,"(r);r=",1,"*r;r=saturate(r);return ",C,"(r,c.a);};\n"]).join(''),
  hash: 0xbb29b5605daab,
  table,
  shake: [[0,[0,3]],[97,[1,3]],[202,[2,3]],[329,[3]]],
  tree: decompressAST([[0,0,97],[2,6,16],[0,91,196],[2,6,17],[0,99,225],[2,3,15],[0,124,271],[1,0,7],[2,11,22],[2,50,60],[2,15,27],[2,18,29]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.tonemapACES = getSymbol("tonemapACES");
//# sourceMappingURL=aces.wgsl.js.map
