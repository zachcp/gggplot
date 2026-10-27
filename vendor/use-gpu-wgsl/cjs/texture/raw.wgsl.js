/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture getSize textureUVToXY infer(T) link vec2<u32> vec2<f32> export infers".split(' '));
const table = {[S]:_(["T",0,1,2]),[W]:_([2]),[X]:[{[A]:14,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([3])},[Z]:_([4]),[P]:[{[N]:"u",[T]:_(5)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:59,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(6),[Z]:_([4])}}],[E]:[{[A]:89,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:"T",[Z]:_([7]),[P]:[{[N]:"u",[T]:_(6)}],[I]:_(["T",1,0])}}],[_(8)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "texture/raw",
  code: _(["@infer ",T," T;@",4," fn ",0,"(u:",5,")->@",3,"T;@",4," fn ",1,"()->",6,";@",7," fn ",2,"(u:",6,")->T{let x=",5,"(u.xy*",1,"());return ",0,"(x);}\n"]).join(''),
  hash: 0x4b0b221e40a08,
  table,
  shake: [[0,[0,1,3]],[14,[1,3]],[59,[2,3]],[89,[3]]],
  tree: decompressAST([[1,0,14],[1,14,58],[1,45,74],[0,30,125],[1,0,7],[2,11,24],[2,28,29],[2,23,30],[2,18,28]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.textureUVToXY = getSymbol("textureUVToXY");
//# sourceMappingURL=raw.wgsl.js.map
