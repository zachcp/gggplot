/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../codec/octahedral.wgsl";
import m1 from "./cube-grid.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture displayCubeColor @use-gpu/wgsl/codec/octahedral decodeOctahedral ./cube-grid getCubeGridOverlay link export vec2<f32>".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3]),[K]:[{[N]:_(3),[J]:_(3)}]},{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]}],[X]:[{[A]:96,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([6]),[P]:[{[N]:"u",[T]:D}]}}],[E]:[{[A]:140,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([7]),[P]:[{[N]:"u",[T]:_(8)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "display/cube-color",
  code: _(["use '",2,"'::{",3,"};use '",4,"'::{",5,"}@",6," fn ",0,"(u:",D,")->",C,";@",7," fn ",1,"(u:",8,")->",C,"{var _1:",D,"=",3,"(u*2.0-1.0);let t=",0,"(_1);let g=",5,"(_1);let t1=g.xyz;let b=g.a;return mix(t,",C,"(t1,1.0),b*0.5);}\n"]).join(''),
  hash: 0x330e59fedc20d,
  table,
  shake: [[96,[0,1]],[140,[1]]],
  tree: decompressAST([[1,0,56],[1,57,96],[1,39,82],[0,44,253],[1,0,7],[2,11,27],[2,58,74],[2,34,44],[2,21,39]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0, "./cube-grid": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const displayCubeColor = getSymbol("displayCubeColor");
//# sourceMappingURL=cube-color.wgsl.js.map
