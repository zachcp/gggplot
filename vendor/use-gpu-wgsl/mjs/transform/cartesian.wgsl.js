/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTransformMatrix getCartesianPosition mat4x4<f32> optional link u32 export".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3,4]),[P]:[{[N]:"i",[T]:_(5)}]}}],[E]:[{[A]:60,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([6]),[P]:[{[N]:"v",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "transform/cartesian",
  code: _(["@",3," @",4," fn ",0,"(i:u32)->",2,"{};@",6," fn ",1,"(v:",C,")->",C,"{return ",0,"(0)*",C,"(v.xyz,1.0);}\n"]).join(''),
  hash: 0x14bfa9750b63f3,
  table,
  shake: [[0,[0,1]],[60,[1]]],
  tree: decompressAST([[4,0,59,0],[1,0,9],[1,10,15],[2,9,27],[0,41,148],[1,0,7],[2,11,31],[2,52,70]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getCartesianPosition = getSymbol("getCartesianPosition");
//# sourceMappingURL=cartesian.wgsl.js.map
