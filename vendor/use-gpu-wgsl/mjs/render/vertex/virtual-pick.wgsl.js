/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/types.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex getPicking VertexOutput main @use-gpu/wgsl/use/types PickVertex link u32 vec2<u32> optional vertex vertexIndex builtin(vertex_index) instanceIndex builtin(instance_index) position builtin(position) fragScissor location(0) fragUV vec2<f32> location(1) fragId location(2) interpolate(flat) fragIndex location(3) locals VertexOutput builtin position location".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]}],[X]:[{[A]:44,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"v",[T]:_(7)},{[N]:"i",[T]:_(7)}]}},{[A]:90,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(8),[Z]:_([9,6]),[P]:[{[N]:"i",[T]:_(7)}]}}],[E]:[{[A]:371,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(2),[Z]:_([10]),[P]:[{[N]:_(11),[T]:_(7),[Z]:_([12])},{[N]:_(13),[T]:_(7),[Z]:_([14])}],[I]:_([2,0,1,2])}}],[_(27)]:[{[A]:164,[R]:_(2),[G]:0,[U]:{[N]:_(2),[M]:[{[N]:_(15),[T]:C,[Z]:_([16])},{[N]:_(17),[T]:C,[Z]:_([18])},{[N]:_(19),[T]:_(20),[Z]:_([21])},{[N]:_(22),[T]:_(7),[Z]:_([23,24])},{[N]:_(25),[T]:_(7),[Z]:_([26,24])}]}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "vertex/virtual-pick",
  code: _(["use '",4,"'::{",5,"};@",6," fn ",0,"(v:u32,i:u32)->",5,"{};@",9," @",6," fn ",1,"(i:u32)->",8,"{return ",8,"(0u,0u);};",U," ",2,"{@",29,"(",15,")",15,":",C,",@",18,17,":",C,",@",21,19,":",20,",@",23,"@",24,22,":u32,@",26,"@",24,25,":u32,};@",10," fn ",3,"(@",29,"(",10,"_index)",10,"Index:u32,@",14,13,":u32,)->",2,"{var v=",0,"(",10,"Index,",13,");var p=",1,"(v.index);return ",2,"(v.",15,",v.scissor,v.uv.xy,p.x,p.y,);}\n"]).join(''),
  hash: 0x9c331a5d2f4d8,
  table,
  shake: [[44,[0,3]],[90,[1,3]],[164,[2,3]],[371,[3]]],
  tree: decompressAST([[1,0,43],[1,44,89],[4,46,119,1],[1,0,9],[1,10,15],[2,9,19],[0,55,261],[2,7,19],[3,13,31],[3,37,49],[3,34,46],[3,29,41],[3,12,30],[3,29,41],[3,12,30],[0,34,275],[3,0,7],[2,11,15],[3,5,27],[3,38,62],[2,45,57],[2,19,28],[2,43,53],[2,27,39]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
//# sourceMappingURL=virtual-pick.wgsl.js.map
