/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getQuadIndex getQuadUV vec2<u32> export u32 vec2<f32>".split(' '));
const table = {[S]:_([0,1]),[W]:_([0,1]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3]),[P]:[{[N]:"v",[T]:_(4)}]}},{[A]:77,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(5),[Z]:_([3]),[P]:[{[N]:"v",[T]:_(4)}],[I]:_([0])}}]};
const data = {
  name: "geometry/quad",
  code: _(["@",3," fn ",0,"(v:u32)->",2,"{return ",2,"(v&1u,(v&2u)>>1u);}@",3," fn ",1,"(v:u32)->",5,"{return ",5,"(",0,"(v));}\n"]).join(''),
  hash: 0x73d3c682f5003,
  table,
  shake: [[0,[0,1]],[77,[1]]],
  tree: decompressAST([[0,0,77],[1,0,7],[2,11,23],[0,66,140],[1,0,7],[2,11,20],[2,45,57]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getQuadIndex = getSymbol("getQuadIndex");
export const getQuadUV = getSymbol("getQuadUV");
//# sourceMappingURL=quad.wgsl.js.map
