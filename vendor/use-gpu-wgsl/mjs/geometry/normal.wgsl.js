/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getOrthoVector export return".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:D,[Z]:_([1]),[P]:[{[N]:"v",[T]:D}]}}]};
const data = {
  name: "geometry/normal",
  code: _(["@",1," fn ",0,"(v:",D,")->",D,"{let a=abs(v);if(a.x<a.y){if(a.x<a.z){",2," ",D,"(0.0,-v.z,v.y);}",2," ",D,"(-v.y,v.x,0.0);}else{if(a.y<a.z){",2," ",D,"(v.z,0.0,-v.x);}",2," ",D,"(-v.y,v.x,0.0);}}\n"]).join(''),
  hash: 0xcd09bd3db96c2,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,233],[1,0,7],[2,11,25]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getOrthoVector = getSymbol("getOrthoVector");
//# sourceMappingURL=normal.wgsl.js.map
