/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../fragment/pbr.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("roughness metalness getDefaultPBRMaterial @use-gpu/wgsl/fragment/pbr PBRParams export PBRParams".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[E]:[{[A]:95,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"c",[T]:C},{[N]:"m",[T]:C},{[N]:"m1",[T]:C}],[I]:_([1,0])}}]};
const data = {
  name: "material/pbr-default",
  code: _(["use '",3,"'::{",4,"};const ",0,":f32=0.35;const ",1,":f32=0.0;@",5," fn ",2,"(c:",C,",m:",C,",m1:",C,",)->",4,"{var a=c;var e=",C,"(0.0);var m2=",C,"(",1,",",0,",0.0,0.0);return ",4,"(a,e,m2,1.0);}\n"]).join(''),
  hash: 0x1da6f656a01bd4,
  table,
  shake: [[46,[0,2]],[71,[1,2]],[95,[2]]],
  tree: decompressAST([[1,0,45],[0,46,71],[2,6,15],[0,19,43],[2,6,15],[0,18,206],[1,0,7],[2,11,32],[2,62,71],[2,56,65],[2,10,19],[2,26,35]], table[S]),
};

const libs = {"@use-gpu/wgsl/fragment/pbr": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getDefaultPBRMaterial = getSymbol("getDefaultPBRMaterial");
//# sourceMappingURL=pbr-default.wgsl.js.map
