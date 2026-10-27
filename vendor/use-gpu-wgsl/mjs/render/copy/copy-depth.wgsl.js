/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getDepth main f32 optional link vec2<f32> builtin(frag_depth) fragment fragUV location(0)".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3,4]),[P]:[{[N]:"u",[T]:_(5)}]}}],[E]:[{[A]:58,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:{[N]:_(2),[Z]:_([6])},[Z]:_([7]),[P]:[{[N]:_(8),[T]:_(5),[Z]:_([9])}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "copy/copy-depth",
  code: _(["@",3," @",4," fn ",0,"(u:",5,")->f32{return 0.0;}@",7," fn ",1,"(@",9,8,":",5,",)->@",6,"f32{return ",0,"(",8,");}\n"]).join(''),
  hash: 0x3f0d6e1d9a058,
  table,
  shake: [[0,[0,1]],[58,[1]]],
  tree: decompressAST([[4,0,58,0],[1,0,9],[1,10,15],[2,9,17],[0,39,138],[3,0,9],[2,13,17],[3,5,17],[3,32,52],[2,31,39]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
//# sourceMappingURL=copy-depth.wgsl.js.map
