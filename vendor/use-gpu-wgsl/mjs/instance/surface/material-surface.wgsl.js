/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/types.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getMaterial getMaterialSurface @use-gpu/wgsl/use/types SurfaceFragment infer(T) link export infers SurfaceFragment".split(' '));
const table = {[S]:_(["T",0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3]),[K]:[{[N]:_(3),[J]:_(3)}]}],[X]:[{[A]:63,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([4])},[Z]:_([5]),[P]:[{[N]:"c",[T]:C},{[N]:"m",[T]:C},{[N]:"m1",[T]:C}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}}],[E]:[{[A]:136,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(3),[Z]:_([6]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_([0])}}],[_(7)]:_(["T"]),[L]:{[_(0)]:true}};
const data = {
  name: "surface/material-surface",
  code: _(["use '",2,"'::{",3,"};@infer ",T," T;@",5," fn ",0,"(c:",C,",m:",C,",m1:",C,",)->@",4,"T{}@",6," fn ",0,"Surface(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->",3,"{let p1=",0,"(c,u,s);let o=",C,"(n.xyz,p1.occlusion);return ",3,"(p,n,o,p1.albedo,p1.emissive,p1.material,c1.z,);}\n"]).join(''),
  hash: 0x1f4239b845f588,
  table,
  shake: [[49,[0,1,2]],[63,[1,2]],[136,[2]]],
  tree: decompressAST([[1,0,48],[1,49,63],[1,14,87],[0,73,340],[1,0,7],[2,11,29],[2,107,122],[2,23,34],[2,62,77]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getMaterialSurface = getSymbol("getMaterialSurface");
//# sourceMappingURL=material-surface.wgsl.js.map
