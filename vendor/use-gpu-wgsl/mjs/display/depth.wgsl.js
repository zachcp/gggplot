/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("displayDepth export f32".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([1]),[P]:[{[N]:"d",[T]:_(2)}]}}]};
const data = {
  name: "display/depth",
  code: _(["@",1," fn ",0,"(d:f32)->",C,"{let h=d>0.0;if(!h){return ",C,"(0.0,0.0,0.1,1.0);}let d1=-log(d);return ",C,"(fract(d1),fract(d1*16.0)*.75,fract(d1*256.0),1.0);}\n"]).join(''),
  hash: 0x1bb815ada462e7,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,179],[1,0,7],[2,11,23]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const displayDepth = getSymbol("displayDepth");
//# sourceMappingURL=depth.wgsl.js.map
