/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getFragment getScissor main optional link location(0) fragment fragColor fragUV location(1) fragST location(2) fragScissor location(3) return location".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([3,4]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}]}},{[A]:89,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([3,4]),[P]:[{[N]:"c",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:165,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:{[N]:C,[Z]:_([5])},[Z]:_([6]),[P]:[{[N]:_(7),[T]:C,[Z]:_([5])},{[N]:_(8),[T]:C,[Z]:_([9])},{[N]:_(10),[T]:C,[Z]:_([11])},{[N]:_(12),[T]:C,[Z]:_([13])}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "fragment/solid",
  code: _(["@",3," @",4," fn ",0,"(c:",C,",u:",C,",s:",C,")->",C,"{",14," c;}@",3," @",4," fn ",1,"(c:",C,",s:",C,")->",C,"{",14," c;}@",6," fn ",2,"(@",5,7,":",C,",@",9,8,":",C,",@",11,10,":",C,",@",13,12,":",C,",)->@",5,C,"{var o=",7,";o=",0,"(o,",8,",",10,");if(HAS_SCISSOR){o=",1,"(o,",12,");}if(HAS_ALPHA_TO_DISCARD){if(o.a<=0.0){discard;}}",14," o;}\n"]).join(''),
  hash: 0x1c1ee156c5c0e5,
  table,
  shake: [[0,[0,2]],[89,[1,2]],[165,[2]]],
  tree: decompressAST([[4,0,89,0],[1,0,9],[1,10,15],[2,9,20],[4,70,146,1],[1,0,9],[1,10,15],[2,9,19],[0,57,374],[3,0,9],[2,13,17],[3,5,17],[3,32,44],[3,29,41],[3,29,41],[3,37,49],[2,40,51],[2,47,57]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
//# sourceMappingURL=solid.wgsl.js.map
