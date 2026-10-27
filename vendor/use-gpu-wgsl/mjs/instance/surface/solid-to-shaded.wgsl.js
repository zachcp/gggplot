/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/types.wgsl";
import m1 from "../../use/view.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("solidToShaded @use-gpu/wgsl/use/types SolidVertex ShadedVertex @use-gpu/wgsl/use/view clipToWorld3D viewToWorld export ShadedVertex".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[O]:[{[A]:0,[N]:_(1),[S]:_([2,3]),[K]:[{[N]:_(2),[J]:_(2)},{[N]:_(3),[J]:_(3)}]},{[A]:0,[N]:_(4),[S]:_([5,6]),[K]:[{[N]:_(5),[J]:_(5)},{[N]:_(6),[J]:_(6)}]}],[E]:[{[A]:116,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(3),[Z]:_([7]),[P]:[{[N]:"v",[T]:_(2)}]}}]};
const data = {
  name: "surface/solid-to-shaded",
  code: _(["use '",1,"'::{",2,",",3,"};use '",4,"'::{",5,",",6,"};@",7," fn ",0,"(v:",2,")->",3,"{let w=",5,"(v.position);let n=",6,"(",C,"(0.0,0.0,1.0,0.0));return ",3,"(v.position,",C,"(w,1.0),n,",C,"(1.0,0.0,0.0,0.0),v.color,v.uv,v.st,v.scissor,v.index,);};\n"]).join(''),
  hash: 0x117a68dd3939f5,
  table,
  shake: [[116,[0]]],
  tree: decompressAST([[1,0,57],[1,58,115],[0,58,306],[1,0,7],[2,11,24],[2,16,27],[2,14,26],[2,19,32],[2,32,43],[2,47,59]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0, "@use-gpu/wgsl/use/view": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const solidToShaded = getSymbol("solidToShaded");
//# sourceMappingURL=solid-to-shaded.wgsl.js.map
