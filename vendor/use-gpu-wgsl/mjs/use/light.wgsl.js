/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../use/types.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("LightUniforms lightUniforms getLightCount getLight @use-gpu/wgsl/use/types Light export count u32 lights array<Light> group(PASS) binding(1) <storage> export lightUniforms".split(' '));
const table = {[Y]:_([0]),[S]:_([0,1,2,3]),[W]:_([0,2,3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]}],[E]:[{[A]:39,[R]:_(0),[G]:1,[U]:{[N]:_(0),[Z]:_([6]),[M]:[{[N]:_(7),[T]:_(8)},{[N]:_(9),[T]:_(10)}]}},{[A]:163,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(8),[Z]:_([6]),[I]:_([1])}},{[A]:223,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"i",[T]:_(8)}],[I]:_([1])}}],[B]:[{[A]:100,[R]:_(1),[G]:32,[V]:{[N]:_(1),[T]:_(0),[Z]:_([11,12]),[I]:_([0]),[Q]:_(13)}}]};
const data = {
  name: "use/light",
  code: _(["use '",4,"'::{",5,"};@",6," ",U," ",0,"{",7,":u32,",9,":array<",5,">,};@",11,"@",12,"var",13,1,":",0,";@",6," fn ",2,"()->u32{return ",1,".",7,";}@",6," fn ",3,"(i:u32)->",5,"{return ",1,".",9,"[i];}\n"]).join(''),
  hash: 0x1805784c916bba,
  table,
  shake: [[39,[0,1,2,3]],[100,[1,2,3]],[163,[2]],[223,[3]]],
  tree: decompressAST([[1,0,38],[0,39,99],[1,0,7],[2,15,28],[2,37,42],[0,9,72],[3,0,12],[3,12,23],[2,23,36],[2,14,27],[0,14,74],[1,0,7],[2,11,24],[2,28,41],[0,21,87],[1,0,7],[2,11,19],[2,17,22],[2,13,26]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const LightUniforms = getSymbol("LightUniforms");
export const getLightCount = getSymbol("getLightCount");
export const getLight = getSymbol("getLight");
//# sourceMappingURL=light.wgsl.js.map
