/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture getOffset downsampleExact2 infer(T) link vec2<u32> optional export infers".split(' '));
const table = {[S]:_(["T",0,1,2]),[W]:_([2]),[X]:[{[A]:14,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([3])},[Z]:_([4]),[P]:[{[N]:"i",[T]:_(5)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:59,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(5),[Z]:_([6,4])}}],[E]:[{[A]:123,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:"T",[Z]:_([7]),[P]:[{[N]:"i",[T]:_(5)}],[I]:_(["T",0,1])}}],[_(8)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "texture/downsample",
  code: _(["@infer ",T," T;@",4," fn ",0,"(i:",5,")->@",3,"T;@",6," @",4," fn ",1,"()->",5,"{return ",5,"(0);};@",7," fn ",2,"(i:",5,")->T{return ",0,"(i*2+",1,"());}\n"]).join(''),
  hash: 0x1c2c2504ce8ed3,
  table,
  shake: [[0,[0,1,3]],[14,[1,3]],[59,[2,3]],[123,[3]]],
  tree: decompressAST([[1,0,14],[1,14,58],[4,45,108,2],[1,0,9],[1,10,15],[2,9,18],[0,45,125],[1,0,7],[2,11,27],[2,31,32],[2,9,19],[2,15,24]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.downsampleExact2 = getSymbol("downsampleExact2");
//# sourceMappingURL=downsample.wgsl.js.map
