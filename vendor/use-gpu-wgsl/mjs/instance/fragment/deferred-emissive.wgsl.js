/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getEmissive getDeferredEmissiveFragment link vec2<f32> export u32".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([2]),[P]:[{[N]:"u",[T]:_(3)}]}}],[E]:[{[A]:45,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([4]),[P]:[{[N]:"u",[T]:_(3)},{[N]:"c",[T]:C},{[N]:"i",[T]:_(5)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "fragment/deferred-emissive",
  code: _(["@",2," fn ",0,"(u:",3,")->",C,";@",4," fn ",1,"(u:",3,",c:",C,",i:u32,)->",C,"{return ",0,"(u);}\n"]).join(''),
  hash: 0x13e0df61fcb38,
  table,
  shake: [[0,[0,1]],[45,[1]]],
  tree: decompressAST([[1,0,44],[0,45,150],[1,0,7],[2,11,38],[2,78,89]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getDeferredEmissiveFragment = getSymbol("getDeferredEmissiveFragment");
//# sourceMappingURL=deferred-emissive.wgsl.js.map
