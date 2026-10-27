/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("decodeRGBM16 export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([1]),[P]:[{[N]:"c",[T]:C}]}}]};
const data = {
  name: "codec/rgbm",
  code: _(["@",1," fn ",0,"(c:",C,")->",C,"{return ",C,"(16.0*c.rgb*c.a,1.0);};\n"]).join(''),
  hash: 0xb4d5a10e244d7,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,86],[1,0,7],[2,11,23]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const decodeRGBM16 = getSymbol("decodeRGBM16");
//# sourceMappingURL=rgbm.wgsl.js.map
