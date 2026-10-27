/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getNorm displayInt f32 optional link export vec4<u32>".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3,4])}}],[E]:[{[A]:47,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([5]),[P]:[{[N]:"s",[T]:_(6)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "display/int",
  code: _(["@",3," @",4," fn ",0,"()->f32{return 1.0;};@",5," fn ",1,"(s:",6,")->",C,"{return ",C,"(s)*",0,"();};\n"]).join(''),
  hash: 0x7ebf54176f557,
  table,
  shake: [[0,[0,1]],[47,[1]]],
  tree: decompressAST([[4,0,46,0],[1,0,9],[1,10,15],[2,9,16],[0,28,105],[1,0,7],[2,11,21],[2,55,62]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.displayInt = getSymbol("displayInt");
//# sourceMappingURL=int.wgsl.js.map
