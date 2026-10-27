/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("DepthSampleOutput getSample selectDepth selectSample main infer(T) link vec2<f32> f32 infer(T1) fragment fragUV location(0) depth builtin(frag_depth) sample locals infers DepthSampleOutput".split(' '));
const table = {[S]:_(["T","TS",0,1,2,3,4]),[W]:_([4]),[X]:[{[A]:107,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:{[N]:"T",[Z]:_([5])},[Z]:_([6]),[P]:[{[N]:"u",[T]:_(7)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:151,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(8),[Z]:_([6]),[P]:[{[N]:"v",[T]:"T"}],[I]:_(["T"])}},{[A]:182,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:{[N]:"TS",[Z]:_([9])},[Z]:_([6]),[P]:[{[N]:"v",[T]:"T"}],[I]:_(["T","TS"]),[H]:[{[N]:"T1",[A]:-1}]}}],[E]:[{[A]:223,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(0),[Z]:_([10]),[P]:[{[N]:_(11),[T]:_(7),[Z]:_([12])}],[I]:_([0,1,0,2,3])}}],[_(16)]:[{[A]:29,[R]:_(0),[G]:0,[U]:{[N]:_(0),[M]:[{[N]:_(13),[T]:_(8),[Z]:_([14])},{[N]:_(15),[T]:"T",[Z]:_([12])}]}}],[_(17)]:_(["T","TS"]),[L]:{[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "copy/copy-select-depth-sample",
  code: _(["@infer ",T," T;@infer ",T," TS;",U," ",0,"{@builtin(frag_",13,")",13,":f32,@",12,15,":T,};@",6," fn ",1,"(u:",7,")->@",5,"T;@",6," fn ",2,"(v:T)->f32;@",6," fn ",3,"(v:T)->@",9,"TS;@",10," fn ",4,"(@",12,11,":",7,",)->",0,"{let s=",1,"(",11,");return ",0,"(",2,"(s),",3,"(s),);}\n"]).join(''),
  hash: 0x151fded7e336ca,
  table,
  shake: [[0,[0,3,6,4,5]],[14,[1,5,6]],[29,[2,6]],[107,[3,6]],[151,[4,6]],[182,[5,6]],[223,[6]]],
  tree: decompressAST([[1,0,14],[1,14,29],[0,15,92],[2,7,24],[3,18,38],[3,30,42],[2,19,20],[1,4,47],[1,44,74],[1,31,71],[0,41,192],[3,0,9],[2,13,17],[3,5,17],[2,32,49],[2,24,33],[2,25,42],[2,18,29],[2,15,27]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
//# sourceMappingURL=copy-select-depth-sample.wgsl.js.map
