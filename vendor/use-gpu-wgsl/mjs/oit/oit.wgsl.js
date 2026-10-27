/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../use/view.wgsl";
import m1 from "../display/depth.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("OITSample getOITSample1 getOITSample @use-gpu/wgsl/use/view depthToView getViewNearFar @use-gpu/wgsl/display/depth displayDepth export color alpha f32 export OITSample".split(' '));
const table = {[Y]:_([0]),[S]:_([0,1,2]),[W]:_([0,1,2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4,5]),[K]:[{[N]:_(4),[J]:_(4)},{[N]:_(5),[J]:_(5)}]},{[A]:0,[N]:_(6),[S]:_([7]),[K]:[{[N]:_(7),[J]:_(7)}]}],[E]:[{[A]:109,[R]:_(0),[G]:1,[U]:{[N]:_(0),[Z]:_([8]),[M]:[{[N]:_(9),[T]:C},{[N]:_(10),[T]:_(11)}]}},{[A]:162,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(0),[Z]:_([8]),[P]:[{[N]:"c",[T]:C},{[N]:"d",[T]:_(11)}],[I]:_([0,0])}},{[A]:297,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(0),[Z]:_([8]),[P]:[{[N]:"c",[T]:C},{[N]:"d",[T]:_(11)}],[I]:_([0,0])}}]};
const data = {
  name: "oit/oit",
  code: _(["use '",3,"'::{",4,",",5,"};use '",6,"'::{",7,"};@",8," ",U," ",0,"{",9,":",C,",",10,":f32,};@",8," fn get",0,"1(c:",C,",d:f32)->",0,"{let d1=d;let d2=d1*d1*d1;let w=c.a*max(1e-2,3e3*d2);return ",0,"(c*w,c.a);};@",8," fn get",0,"(c:",C,",d:f32)->",0,"{let z=",4,"(d);let n=",5,"();let r=(abs(z)-n.x)/(n.y-n.x);let r1=(1.0-r)/(1.0+r);let d1=r1;let d2=d1*d1*d1;let w=c.a*max(1e-2,3e3*d2);return ",0,"(c*w,c.a);};\n"]).join(''),
  hash: 0x512ba28cecff9,
  table,
  shake: [[109,[0,1,2]],[162,[1]],[297,[2]]],
  tree: decompressAST([[1,0,58],[1,59,108],[0,50,102],[1,0,7],[2,15,24],[0,38,172],[1,0,7],[2,11,24],[2,34,43],[2,69,78],[0,21,251],[1,0,7],[2,11,23],[2,33,42],[2,16,27],[2,21,35],[2,129,138]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0, "@use-gpu/wgsl/display/depth": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const OITSample = getSymbol("OITSample");
export const getOITSample1 = getSymbol("getOITSample1");
export const getOITSample = getSymbol("getOITSample");
//# sourceMappingURL=oit.wgsl.js.map
