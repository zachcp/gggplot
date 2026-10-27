/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/view.wgsl";
import m1 from "../../use/types.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSolidFragment @use-gpu/wgsl/use/view getViewPosition @use-gpu/wgsl/use/types SurfaceFragment export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[O]:[{[A]:0,[N]:_(1),[S]:_([2]),[K]:[{[N]:_(2),[J]:_(2)}]},{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[E]:[{[A]:97,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([5]),[P]:[{[N]:"s",[T]:_(4)}]}}]};
const data = {
  name: "fragment/solid",
  code: _(["use '",1,"'::{",2,"};use '",3,"'::{",4,"};@",5," fn ",0,"(s:",4,",)->",C,"{let r=s.albedo.rgb+s.emissive.rgb;let a=s.albedo.a;if(HAS_ALPHA_TO_COVERAGE){return ",C,"(r,a);}else{return ",C,"(r*a,a);}}\n"]).join(''),
  hash: 0xbd264486df020,
  table,
  shake: [[97,[0]]],
  tree: decompressAST([[1,0,47],[1,48,96],[0,49,239],[1,0,7],[2,11,27],[2,19,34]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0, "@use-gpu/wgsl/use/types": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getSolidFragment = getSymbol("getSolidFragment");
//# sourceMappingURL=solid.wgsl.js.map
