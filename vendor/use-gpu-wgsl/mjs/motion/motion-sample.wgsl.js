/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../use/view.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getDepth getReprojectionMatrix getMotionSample @use-gpu/wgsl/use/view clipUVToXY to3D f32 link vec2<f32> mat4x4<f32> export".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4,5]),[K]:[{[N]:_(4),[J]:_(4)},{[N]:_(5),[J]:_(5)}]}],[X]:[{[A]:48,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(6),[Z]:_([7]),[P]:[{[N]:"u",[T]:_(8)}]}},{[A]:84,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(9),[Z]:_([7])}}],[E]:[{[A]:130,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([10]),[P]:[{[N]:"u",[T]:_(8)}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "motion/motion-sample",
  code: _(["use '",3,"'::{",4,",",5,"};@",7," fn ",0,"(u:",8,")->f32;@",7," fn ",1,"()->",9,";@",10," fn ",2,"(u:",8,")->",C,"{let c=",0,"(u);let c1=",4,"(u);let c2=",C,"(c1,c,1.0);let r=",5,"(",1,"()*c2);let d=c2.xyz-r.xyz;let d1=",D,"(d)*",D,"(0.5,-0.5,1.0);return ",C,"(d1,c);};\n"]).join(''),
  hash: 0x62d6e7478e3bb,
  table,
  shake: [[48,[0,2]],[84,[1,2]],[130,[2]]],
  tree: decompressAST([[1,0,47],[1,48,83],[1,36,81],[0,46,289],[1,0,7],[2,11,26],[2,46,54],[2,19,29],[2,47,51],[2,5,26]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getMotionSample = getSymbol("getMotionSample");
//# sourceMappingURL=motion-sample.wgsl.js.map
