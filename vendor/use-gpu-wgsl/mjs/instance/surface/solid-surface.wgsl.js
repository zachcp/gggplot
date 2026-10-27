/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/types.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getMaterial getSolidSurface @use-gpu/wgsl/use/types SurfaceFragment optional link export SurfaceFragment".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3]),[K]:[{[N]:_(3),[J]:_(3)}]}],[X]:[{[A]:49,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([4,5]),[P]:[{[N]:"c",[T]:C},{[N]:"m",[T]:C},{[N]:"m1",[T]:C}]}}],[E]:[{[A]:140,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(3),[Z]:_([6]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "surface/solid-surface",
  code: _(["use '",2,"'::{",3,"};@",4," @",5," fn ",0,"(c:",C,",m:",C,",m1:",C,",)->",C,"{return c;}@",6," fn ",1,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->",3,"{let a=",0,"(c,u,s);return ",3,"(p,n,",C,"(n.xyz,1.0),",C,"(0.0,0.0,0.0,a.a),",C,"(a.rgb,0.0),",C,"(0.0,0.0,0.0,1.0),0.0,);}\n"]).join(''),
  hash: 0x17319ada93c1ac,
  table,
  shake: [[49,[0,1]],[140,[1]]],
  tree: decompressAST([[1,0,48],[4,49,140,0],[1,0,9],[1,10,15],[2,9,20],[0,72,358],[1,0,7],[2,11,26],[2,104,119],[2,22,33],[2,26,41]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getSolidSurface = getSymbol("getSolidSurface");
//# sourceMappingURL=solid-surface.wgsl.js.map
