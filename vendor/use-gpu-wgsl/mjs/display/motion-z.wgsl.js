/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("displayMotionZ export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([1]),[P]:[{[N]:"s",[T]:C}]}}]};
const data = {
  name: "display/motion-z",
  code: _(["@",1," fn ",0,"(s:",C,")->",C,"{return ",C,"(s.xyz*16384.0+0.5,1.0);};\n"]).join(''),
  hash: 0x14226ed323ca77,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,91],[1,0,7],[2,11,25]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const displayMotionZ = getSymbol("displayMotionZ");
//# sourceMappingURL=motion-z.wgsl.js.map
