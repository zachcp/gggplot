/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSample main infer(T) link vec2<f32> location(0) fragment fragUV infers".split(' '));
const table = {[S]:_(["T",0,1]),[W]:_([1]),[X]:[{[A]:14,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([2])},[Z]:_([3]),[P]:[{[N]:"u",[T]:_(4)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}}],[E]:[{[A]:58,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:{[N]:"T",[Z]:_([5])},[Z]:_([6]),[P]:[{[N]:_(7),[T]:_(4),[Z]:_([5])}],[I]:_(["T",0])}}],[_(8)]:_(["T"]),[L]:{[_(0)]:true}};
const data = {
  name: "copy/copy-sample",
  code: _(["@infer ",T," T;@",3," fn ",0,"(u:",4,")->@",2,"T;@",6," fn ",1,"(@",5,7,":",4,",)->@",5,"T{return ",0,"(",7,");}\n"]).join(''),
  hash: 0x1f7fecb2de0641,
  table,
  shake: [[0,[0,1,2]],[14,[1,2]],[58,[2]]],
  tree: decompressAST([[1,0,14],[1,14,57],[0,44,134],[3,0,9],[2,13,17],[3,5,17],[3,32,44],[2,12,13],[2,9,18]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
//# sourceMappingURL=copy-sample.wgsl.js.map
