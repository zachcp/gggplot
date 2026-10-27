/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("SH_DIFFUSE SH_SPECULAR auto export array(vec3<f32>(0.635276,0.532468,0.512984),vec3<f32>(0.451552,0.408482,0.447719),vec3<f32>(0.078325,0.204621,0.288570),vec3<f32>(0.000722,0.121063,0.197819),vec3<f32>(-0.049858,0.064879,0.141657),vec3<f32>(0.088949,0.173688,0.239403),vec3<f32>(0.013520,0.015829,0.014436),vec3<f32>(0.068838,0.083079,0.087478),vec3<f32>(0.042346,0.016693,-0.012206),) value constant array(vec3<f32>(0.202215,0.169490,0.163288),vec3<f32>(0.215600,0.195036,0.213770),vec3<f32>(0.037397,0.097700,0.137782),vec3<f32>(0.000345,0.057803,0.094452),vec3<f32>(-0.063482,0.082606,0.180363),vec3<f32>(0.113253,0.221147,0.304818),vec3<f32>(0.017214,0.020155,0.018381),vec3<f32>(0.087647,0.105779,0.111380),vec3<f32>(0.053916,0.021254,-0.015541),vec3<f32>(0.011208,0.009258,0.007830),vec3<f32>(0.323404,0.325896,0.312886),vec3<f32>(0.077151,0.087505,0.094949),vec3<f32>(-0.016024,-0.010613,-0.012882),vec3<f32>(0.006476,0.012867,0.014688),vec3<f32>(-0.030178,-0.029353,-0.051008),vec3<f32>(0.043039,0.018020,-0.002892),)".split(' '));
const table = {[S]:_([0,1]),[W]:_([0,1]),[E]:[{[A]:0,[R]:_(0),[G]:1,[_(6)]:{[N]:_(0),[T]:_(2),[Z]:_([3]),[_(5)]:_(4)}},{[A]:377,[R]:_(1),[G]:1,[_(6)]:{[N]:_(1),[T]:_(2),[Z]:_([3]),[_(5)]:_(7)}}]};
const data = {
  name: "env/pisa",
  code: _(["@",3," const ",0,"=",4,";@",3," const ",1,"=",7,";\n"]).join(''),
  hash: 0x1ed018e186defb,
  table,
  shake: [[0,[0]],[377,[1]]],
  tree: decompressAST([[0,0,377],[1,0,7],[2,14,24],[0,363,1014],[1,0,7],[2,14,25]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const SH_DIFFUSE = getSymbol("SH_DIFFUSE");
export const SH_SPECULAR = getSymbol("SH_SPECULAR");
//# sourceMappingURL=pisa.wgsl.js.map
