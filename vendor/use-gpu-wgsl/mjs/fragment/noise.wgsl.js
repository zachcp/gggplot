/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("IGN f32 export vec2<u32> u32".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(1),[Z]:_([2]),[P]:[{[N]:"x",[T]:_(3)},{[N]:"f",[T]:_(4)}]}}]};
const data = {
  name: "fragment/noise",
  code: _(["@",2," fn IGN(x:",3,",f:u32)->f32{let u=vec2<f32>(x)+5.588238*f32(f % 64);let _1=dot(vec2<f32>(0.06711056,0.00583715),u)% 1.0;return(52.9829189*_1)% 1.0;};\n"]).join(''),
  hash: 0x3696b4a284bef,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,159],[1,0,7],[2,11,14]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const IGN = getSymbol("IGN");
//# sourceMappingURL=noise.wgsl.js.map
