/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../codec/octahedral.wgsl";
import m1 from "./cube-grid.wgsl";
import m2 from "./depth.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture displayCubeDepth @use-gpu/wgsl/codec/octahedral decodeOctahedral ./cube-grid getCubeGridOverlay ./depth displayDepth link export vec2<f32>".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3]),[K]:[{[N]:_(3),[J]:_(3)}]},{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]},{[A]:0,[N]:_(6),[S]:_([7]),[K]:[{[N]:_(7),[J]:_(7)}]}],[X]:[{[A]:127,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([8]),[P]:[{[N]:"u",[T]:D}]}}],[E]:[{[A]:171,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([9]),[P]:[{[N]:"u",[T]:_(10)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "display/cube-depth",
  code: _(["use '",2,"'::{",3,"};use '",4,"'::{",5,"};use '",6,"'::{",7,"};@",8," fn ",0,"(u:",D,")->",C,";@",9," fn ",1,"(u:",10,")->",C,"{var _1:",D,"=",3,"((u*2.0-1.0)*",10,"(1.0,-1.0));let t=",0,"(_1);let g=",5,"(_1);let t1=g.xyz;let b=g.a;let d=",7,"(t.x);return mix(d,",C,"(t1,1.0),b*0.5);}\n"]).join(''),
  hash: 0xe4a2d9b4e33ef,
  table,
  shake: [[127,[0,1]],[171,[1]]],
  tree: decompressAST([[1,0,56],[1,57,96],[1,40,69],[1,30,73],[0,44,299],[1,0,7],[2,11,27],[2,58,74],[2,56,66],[2,21,39],[2,52,64]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0, "./cube-grid": m1, "./depth": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const displayCubeDepth = getSymbol("displayCubeDepth");
//# sourceMappingURL=cube-depth.wgsl.js.map
