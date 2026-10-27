/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getScissor getPositionScissor getUVScissor getSTScissor link export getScissor export return".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([1,2,3]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([4]),[P]:[{[N]:"v",[T]:C}]}}],[E]:[{[A]:44,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([5]),[P]:[{[N]:"p",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}],[I]:_([0])}},{[A]:145,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([5]),[P]:[{[N]:"p",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}],[I]:_([0])}},{[A]:240,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([5]),[P]:[{[N]:"p",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "scissor/scissor-level",
  code: _(["@",4," fn ",0,"(v:",C,")->",C,";@",5," fn ",1,"(p:",C,",u:",C,",s:",C,")->",C,"{",8," ",0,"(p);};@",5," fn ",2,"(p:",C,",u:",C,",s:",C,")->",C,"{",8," ",0,"(u);};@",5," fn ",3,"(p:",C,",u:",C,",s:",C,")->",C,"{",8," ",0,"(s);};\n"]).join(''),
  hash: 0x12a5cd5e9111ce,
  table,
  shake: [[0,[0,1,2,3]],[44,[1]],[145,[2]],[240,[3]]],
  tree: decompressAST([[1,0,43],[0,44,144],[1,0,7],[2,11,29],[2,74,84],[0,16,110],[1,0,7],[2,11,23],[2,68,78],[0,16,110],[1,0,7],[2,11,23],[2,68,78]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getPositionScissor = getSymbol("getPositionScissor");
export const getUVScissor = getSymbol("getUVScissor");
export const getSTScissor = getSymbol("getSTScissor");
//# sourceMappingURL=scissor-level.wgsl.js.map
