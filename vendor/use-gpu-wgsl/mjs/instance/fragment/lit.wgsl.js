/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/view.wgsl";
import m1 from "../../use/types.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("applyLights applyEnvironment getLitFragment @use-gpu/wgsl/use/view getViewPosition @use-gpu/wgsl/use/types SurfaceFragment optional link export SurfaceFragment return".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]},{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]}],[X]:[{[A]:97,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:D,[Z]:_([7,8]),[P]:[{[N]:"N",[T]:D},{[N]:"V",[T]:D},{[N]:"s",[T]:_(6)}]}},{[A]:206,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:D,[Z]:_([7,8]),[P]:[{[N]:"N",[T]:D},{[N]:"V",[T]:D},{[N]:"s",[T]:_(6)}]}}],[E]:[{[A]:320,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([9]),[P]:[{[N]:"s",[T]:_(6)}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "fragment/lit",
  code: _(["use '",3,"'::{",4,"};use '",5,"'::{",6,"};@",7," @",8," fn ",0,"(N:",D,",V:",D,",s:",6,",)->",D,"{",11," ",D,"(0.0);}@",7," @",8," fn ",1,"(N:",D,",V:",D,",s:",6,",)->",D,"{",11," ",D,"(0.0);}@",9," fn ",2,"(s:",6,",)->",C,"{let v=",4,"();let s1=s.position.xyz;let t=v.xyz-s1*v.w;let N:",D,"=normalize(s.normal.xyz);let V:",D,"=normalize(t);let l=s.emissive.xyz+",0,"(N,V,s)+",1,"(N,V,s);let a=s.albedo.a;if(HAS_ALPHA_TO_COVERAGE){",11," ",C,"(l,a);}else{",11," ",C,"(l*a,a);}}\n"]).join(''),
  hash: 0x5e88e5a1cef22,
  table,
  shake: [[97,[0,2]],[206,[1,2]],[320,[2]]],
  tree: decompressAST([[1,0,47],[1,48,96],[4,49,158,0],[1,0,9],[1,10,15],[2,9,20],[2,38,53],[4,52,166,1],[1,0,9],[1,10,15],[2,9,25],[2,43,58],[0,52,404],[1,0,7],[2,11,25],[2,17,32],[2,35,50],[2,149,160],[2,19,35]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0, "@use-gpu/wgsl/use/types": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getLitFragment = getSymbol("getLitFragment");
//# sourceMappingURL=lit.wgsl.js.map
