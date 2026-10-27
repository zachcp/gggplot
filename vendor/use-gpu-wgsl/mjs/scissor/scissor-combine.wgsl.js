/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getScissorA getScissorB getScissorCombine link export".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([3]),[P]:[{[N]:"v",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}]}},{[A]:69,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:C,[Z]:_([3]),[P]:[{[N]:"v",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:138,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([4]),[P]:[{[N]:"v",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "scissor/scissor-combine",
  code: _(["@",3," fn ",0,"(v:",C,",u:",C,",s:",C,")->",C,";@",3," fn ",1,"(v:",C,",u:",C,",s:",C,")->",C,";@",4," fn ",2,"(v:",C,",u:",C,",s:",C,")->",C,"{return min(",0,"(v,u,s),",1,"(v,u,s));};\n"]).join(''),
  hash: 0x17b0ae1f64407b,
  table,
  shake: [[0,[0,2]],[69,[1,2]],[138,[2]]],
  tree: decompressAST([[1,0,68],[1,69,137],[0,69,197],[1,0,7],[2,11,28],[2,77,88],[2,19,30]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getScissorCombine = getSymbol("getScissorCombine");
//# sourceMappingURL=scissor-combine.wgsl.js.map
