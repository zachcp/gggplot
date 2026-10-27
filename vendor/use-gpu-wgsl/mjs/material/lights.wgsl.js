/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../use/types.wgsl";
import m1 from "../fragment/pbr.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("applyLight getLightCount getLight applyLights @use-gpu/wgsl/use/types Light @use-gpu/wgsl/fragment/pbr PBR link surface infer(T) u32 export infers".split(' '));
const table = {[S]:_(["T",0,1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]},{[A]:0,[N]:_(6),[S]:_([7]),[K]:[{[N]:_(7),[J]:_(7)}]}],[X]:[{[A]:93,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:D,[Z]:_([8]),[P]:[{[N]:"N",[T]:D},{[N]:"V",[T]:D},{[N]:"l",[T]:_(5)},{[N]:_(9),[T]:"T",[Z]:_([10])}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:3}]}},{[A]:178,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(11),[Z]:_([8])}},{[A]:208,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(5),[Z]:_([8]),[P]:[{[N]:"i",[T]:_(11)}]}}],[E]:[{[A]:240,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:D,[Z]:_([12]),[P]:[{[N]:"N",[T]:D},{[N]:"V",[T]:D},{[N]:"s",[T]:"T"}],[I]:_(["T",1,2,0])}}],[_(13)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "material/lights",
  code: _(["use '",4,"'::{",5,"};use '",6,"'::{PBR};@infer ",T," T;@",8," fn ",0,"(N:",D,",V:",D,",l:",5,",@",10,9,":T,)->",D,"{}@",8," fn ",1,"()->u32;@",8," fn ",2,"(i:u32)->",5,";@",12," fn ",0,"s(N:",D,",V:",D,",s:T,)->",D,"{var r:",D,"=",D,"(0.0);let l=",1,"();let n=min(l,1024u);for(var i=0u;i<l;i++){let l1=",2,"(i);let r1=",0,"(N,V,l1,s);r+=r1;}return r;}\n"]).join(''),
  hash: 0x17cf1997ddf796,
  table,
  shake: [[79,[0,1,4]],[93,[1,4]],[178,[2,4]],[208,[3,4]],[240,[4]]],
  tree: decompressAST([[1,0,38],[1,39,78],[1,40,54],[1,14,99],[1,85,114],[1,30,61],[0,32,254],[1,0,7],[2,11,22],[2,38,39],[2,52,65],[2,64,72],[2,19,29]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0, "@use-gpu/wgsl/fragment/pbr": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const applyLights = getSymbol("applyLights");
//# sourceMappingURL=lights.wgsl.js.map
