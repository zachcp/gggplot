/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/types.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex VertexOutput VertexOutputWithDepth main mainWithDepth @use-gpu/wgsl/use/types SolidVertex link u32 vertex vertexIndex builtin(vertex_index) instanceIndex builtin(instance_index) export position builtin(position) fragAlpha f32 location(0) fragUV location(1) fragST location(2) fragScissor location(3) fragPosition location(4) locals getVertex VertexOutput builtin position location VertexOutputWithDepth vertexIndex instanceIndex".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([3,4]),[O]:[{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]}],[X]:[{[A]:45,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(6),[Z]:_([7]),[P]:[{[N]:"v",[T]:_(8)},{[N]:"i",[T]:_(8)}]}}],[E]:[{[A]:490,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(1),[Z]:_([9]),[P]:[{[N]:_(10),[T]:_(8),[Z]:_([11])},{[N]:_(12),[T]:_(8),[Z]:_([13])}],[I]:_([1,0,1])}},{[A]:709,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(2),[Z]:_([9,14]),[P]:[{[N]:_(10),[T]:_(8),[Z]:_([11])},{[N]:_(12),[T]:_(8),[Z]:_([13])}],[I]:_([2,0,2])}}],[_(28)]:[{[A]:92,[R]:_(1),[G]:0,[U]:{[N]:_(1),[M]:[{[N]:_(15),[T]:C,[Z]:_([16])},{[N]:_(17),[T]:_(18),[Z]:_([19])},{[N]:_(20),[T]:C,[Z]:_([21])},{[N]:_(22),[T]:C,[Z]:_([23])},{[N]:_(24),[T]:C,[Z]:_([25])}]}},{[A]:269,[R]:_(2),[G]:0,[U]:{[N]:_(2),[M]:[{[N]:_(15),[T]:C,[Z]:_([16])},{[N]:_(17),[T]:_(18),[Z]:_([19])},{[N]:_(20),[T]:C,[Z]:_([21])},{[N]:_(22),[T]:C,[Z]:_([23])},{[N]:_(26),[T]:C,[Z]:_([25])},{[N]:_(24),[T]:C,[Z]:_([27])}]}}],[L]:{[_(0)]:true}};
const data = {
  name: "vertex/virtual-depth",
  code: _(["use '",5,"'::{",6,"};@",7," fn ",0,"(v:u32,i:u32)->",6,"{};",U," ",1,"{@",31,"(",15,")",15,":",C,",@",19,17,":f32,@",21,20,":",C,",@",23,22,":",C,",@",25,24,":",C,",};",U," ",1,"WithDepth{@",31,"(",15,")",15,":",C,",@",19,17,":f32,@",21,20,":",C,",@",23,22,":",C,",@",25,26,":",C,",@",27,24,":",C,",};@",9," fn ",3,"(@",31,"(",9,"_index)",9,"Index:u32,@",13,12,":u32,)->",1,"{let v=",0,"(",9,"Index,",12,");return ",1,"(v.",15,",v.color.a,v.uv,v.st,v.scissor,);}@",9," @",14," fn ",3,"WithDepth(@",31,"(",9,"_index)",9,"Index:u32,@",13,12,":u32,)->",1,"WithDepth{let v=",0,"(",9,"Index,",12,");return ",1,"WithDepth(v.",15,",v.color.a,v.uv,v.st,v.world,v.scissor,);}\n"]).join(''),
  hash: 0xa7ff1d2a18ea5,
  table,
  shake: [[45,[0,3,4]],[92,[1,3]],[269,[2,4]],[490,[3]],[709,[4]]],
  tree: decompressAST([[1,0,44],[1,45,91],[0,47,223],[2,7,19],[3,13,31],[3,37,49],[3,26,38],[3,29,41],[3,29,41],[0,36,256],[2,7,28],[3,22,40],[3,37,49],[3,26,38],[3,29,41],[3,29,41],[3,35,47],[0,36,255],[3,0,7],[2,11,15],[3,5,27],[3,38,62],[2,45,57],[2,19,28],[2,44,56],[0,57,319],[3,0,7],[1,8,15],[2,11,24],[3,14,36],[3,38,62],[2,45,66],[2,28,37],[2,44,65]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
export const mainWithDepth = getSymbol("mainWithDepth");
//# sourceMappingURL=virtual-depth.wgsl.js.map
