/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../display/depth.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("loadColor loadRevealage getSize EPS getOITResolve @use-gpu/wgsl/display/depth displayDepth link vec2<u32> f32 vec2<f32> export".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([4]),[O]:[{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]}],[X]:[{[A]:50,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([7]),[P]:[{[N]:"x",[T]:_(8)}]}},{[A]:93,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(9),[Z]:_([7]),[P]:[{[N]:"x",[T]:_(8)}]}},{[A]:134,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(10),[Z]:_([7])}}],[E]:[{[A]:179,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:C,[Z]:_([11]),[P]:[{[N]:"t",[T]:_(10)}],[I]:_([2,0,1])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "oit/oit-resolve",
  code: _(["use '",5,"'::{",6,"};@",7," fn ",0,"(x:",8,")->",C,";@",7," fn ",1,"(x:",8,")->f32;@",7," fn ",2,"()->",10,";const EPS=1e-6;@",11," fn ",4,"(t:",10,")->",C,"{let s=t*",2,"();let x=",8,"(s);let c=",0,"(x);let r=",1,"(x);return ",C,"(c.rgb/clamp(c.a,1e-4,5e4),1.0-r.r);}\n"]).join(''),
  hash: 0x15d474d541f898,
  table,
  shake: [[50,[0,4]],[93,[1,4]],[134,[2,4]],[164,[3]],[179,[4]]],
  tree: decompressAST([[1,0,49],[1,50,92],[1,43,83],[1,41,70],[0,30,45],[2,6,9],[0,9,190],[1,0,7],[2,11,24],[2,46,53],[2,35,44],[2,19,32]], table[S]),
};

const libs = {"@use-gpu/wgsl/display/depth": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getOITResolve = getSymbol("getOITResolve");
//# sourceMappingURL=oit-resolve.wgsl.js.map
