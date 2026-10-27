/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/view.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getFragment main @use-gpu/wgsl/use/view getViewResolution link vec2<f32> u32 location(0) fragment fragCoord builtin(position) lightIndex interpolate(flat) fragCoord".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3]),[K]:[{[N]:_(3),[J]:_(3)}]}],[X]:[{[A]:50,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([4]),[P]:[{[N]:"u",[T]:_(5)},{[N]:"c",[T]:C},{[N]:"i",[T]:_(6)}]}}],[E]:[{[A]:113,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:{[N]:C,[Z]:_([7])},[Z]:_([8]),[P]:[{[N]:_(9),[T]:C,[Z]:_([10])},{[N]:_(11),[T]:_(6),[Z]:_([7,12])}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "fragment/deferred-light",
  code: _(["use '",2,"'::{",3,"};@",4," fn ",0,"(u:",5,",c:",C,",i:u32)->",C,";@",8," fn ",1,"(@",10,9,":",C,",@",7,"@",12,11,":u32,)->@",7,C,"{var u=",5,"(",9,".xy)*",3,"();var o=",0,"(u,",9,",",11,");return ",C,"(o.rgb,1.0);}\n"]).join(''),
  hash: 0x1fcfff3e6ff11b,
  table,
  shake: [[50,[0,1]],[113,[1]]],
  tree: decompressAST([[1,0,49],[1,50,112],[0,63,310],[3,0,9],[2,13,17],[3,5,23],[3,38,50],[3,12,30],[3,36,48],[2,52,69],[2,26,37]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
//# sourceMappingURL=deferred-light.wgsl.js.map
