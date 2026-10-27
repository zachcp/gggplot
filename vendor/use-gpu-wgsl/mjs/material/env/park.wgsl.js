/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("SH_DIFFUSE SH_SPECULAR auto export array(vec3<f32>(0.407463,0.512907,0.560060),vec3<f32>(0.304353,0.406098,0.547452),vec3<f32>(0.039094,0.041564,-0.038478),vec3<f32>(0.051974,0.022462,-0.049525),vec3<f32>(0.012576,-0.021732,-0.073779),vec3<f32>(0.015867,0.016420,-0.013053),vec3<f32>(0.017854,0.015396,0.007058),vec3<f32>(0.031431,0.049632,0.095778),vec3<f32>(0.042348,0.038642,0.002004),) value constant array(vec3<f32>(0.129699,0.163263,0.178273),vec3<f32>(0.145318,0.193897,0.261389),vec3<f32>(0.018666,0.019845,-0.018372),vec3<f32>(0.024816,0.010725,-0.023646),vec3<f32>(0.016012,-0.027670,-0.093938),vec3<f32>(0.020203,0.020906,-0.016619),vec3<f32>(0.022733,0.019603,0.008986),vec3<f32>(0.040020,0.063194,0.121948),vec3<f32>(0.053919,0.049201,0.002551),vec3<f32>(0.008604,0.010379,0.010502),vec3<f32>(0.036525,0.123163,0.308115),vec3<f32>(0.066994,0.080063,0.085160),vec3<f32>(-0.000887,0.002242,-0.000136),vec3<f32>(0.005252,0.003595,-0.006013),vec3<f32>(0.060987,0.027511,-0.024443),vec3<f32>(-0.010356,0.006443,0.049597),)".split(' '));
const table = {[S]:_([0,1]),[W]:_([0,1]),[E]:[{[A]:0,[R]:_(0),[G]:1,[_(6)]:{[N]:_(0),[T]:_(2),[Z]:_([3]),[_(5)]:_(4)}},{[A]:380,[R]:_(1),[G]:1,[_(6)]:{[N]:_(1),[T]:_(2),[Z]:_([3]),[_(5)]:_(7)}}]};
const data = {
  name: "env/park",
  code: _(["@",3," const ",0,"=",4,";@",3," const ",1,"=",7,";\n"]).join(''),
  hash: 0x1898a01a8cebe4,
  table,
  shake: [[0,[0]],[380,[1]]],
  tree: decompressAST([[0,0,380],[1,0,7],[2,14,24],[0,366,1018],[1,0,7],[2,14,25]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const SH_DIFFUSE = getSymbol("SH_DIFFUSE");
export const SH_SPECULAR = getSymbol("SH_SPECULAR");
//# sourceMappingURL=park.wgsl.js.map
