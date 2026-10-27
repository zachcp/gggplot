/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("depthWeight normalWeight f32 export".split(' '));
const table = {[S]:_([0,1]),[W]:_([0,1]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3]),[P]:[{[N]:"a",[T]:_(2)},{[N]:"b",[T]:_(2)}]}},{[A]:132,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(2),[Z]:_([3]),[P]:[{[N]:"a",[T]:D},{[N]:"b",[T]:D}]}}]};
const data = {
  name: "ssao/ssao-weight",
  code: _(["@",3," fn ",0,"(a:f32,b:f32)->f32{return max(0.0,min(select(0.0,a/b,b>0),select(0.0,b/a,a>0),)*DEPTH_RAMP-(DEPTH_RAMP-1.0));}@",3," fn ",1,"(a:",D,",b:",D,")->f32{return max(0.0,dot(a,b)*NORMAL_RAMP-(NORMAL_RAMP-1.0));}\n"]).join(''),
  hash: 0x14cdb4b880a67d,
  table,
  shake: [[0,[0]],[132,[1]]],
  tree: decompressAST([[0,0,132],[1,0,7],[2,11,22],[0,121,231],[1,0,7],[2,11,23]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const depthWeight = getSymbol("depthWeight");
export const normalWeight = getSymbol("normalWeight");
//# sourceMappingURL=ssao-weight.wgsl.js.map
