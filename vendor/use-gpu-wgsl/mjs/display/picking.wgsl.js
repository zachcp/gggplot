/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("displayPicking export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([1]),[P]:[{[N]:"s",[T]:C}]}}]};
const data = {
  name: "display/picking",
  code: _(["@",1," fn ",0,"(s:",C,")->",C,"{let p=vec2<f32>(bitcast<vec2<u32>>(s.xy));let a=(p.r/16.0)% 1.0;let b=(p.g/16.0)% 1.0;let c=(p.r+p.g)/256.0;return sqrt(",C,"(a,c,b,1.0));}\n"]).join(''),
  hash: 0x1d4023a523ea88,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,193],[1,0,7],[2,11,25]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const displayPicking = getSymbol("displayPicking");
//# sourceMappingURL=picking.wgsl.js.map
