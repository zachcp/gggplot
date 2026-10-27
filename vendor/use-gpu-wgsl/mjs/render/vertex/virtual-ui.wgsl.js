/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/types.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex toColorSpace VertexOutput main @use-gpu/wgsl/use/types UIVertex link u32 optional vertex vertexIndex builtin(vertex_index) instanceIndex builtin(instance_index) position builtin(position) fragUV vec2<f32> location(0) fragTextureUV location(1) fragTextureST location(2) fragClipUV location(3) fragSDFUV location(4) fragSDFConfig location(5) interpolate(flat) fragRepeat i32 location(6) fragMode location(7) fragShape location(8) fragRadius location(9) fragBorder location(10) fragStroke location(11) fragFill location(12) fragScissor location(13) locals toColorSpace VertexOutput builtin position location interpolate".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]}],[X]:[{[A]:42,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"v",[T]:_(7)},{[N]:"i",[T]:_(7)}]}},{[A]:86,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([8,6]),[P]:[{[N]:"c",[T]:C}]}}],[E]:[{[A]:827,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(2),[Z]:_([9]),[P]:[{[N]:_(10),[T]:_(7),[Z]:_([11])},{[N]:_(12),[T]:_(7),[Z]:_([13])}],[I]:_([2,0,2,1])}}],[_(47)]:[{[A]:152,[R]:_(2),[G]:0,[U]:{[N]:_(2),[M]:[{[N]:_(14),[T]:C,[Z]:_([15])},{[N]:_(16),[T]:_(17),[Z]:_([18])},{[N]:_(19),[T]:_(17),[Z]:_([20])},{[N]:_(21),[T]:_(17),[Z]:_([22])},{[N]:_(23),[T]:C,[Z]:_([24])},{[N]:_(25),[T]:_(17),[Z]:_([26])},{[N]:_(27),[T]:C,[Z]:_([28,29])},{[N]:_(30),[T]:_(31),[Z]:_([32,29])},{[N]:_(33),[T]:_(31),[Z]:_([34,29])},{[N]:_(35),[T]:C,[Z]:_([36,29])},{[N]:_(37),[T]:C,[Z]:_([38,29])},{[N]:_(39),[T]:C,[Z]:_([40,29])},{[N]:_(41),[T]:C,[Z]:_([42,29])},{[N]:_(43),[T]:C,[Z]:_([44,29])},{[N]:_(45),[T]:C,[Z]:_([46,29])}]}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "vertex/virtual-ui",
  code: _(["use '",4,"'::{",5,"};@",6," fn ",0,"(v:u32,i:u32)->",5,"{};@",8," @",6," fn ",1,"(c:",C,")->",C,"{return c;}",U," ",2,"{@",50,"(",14,")",14,":",C,",@",18,16,":",17,",@",20,19,":",17,",@",22,21,":",17,",@",24,23,":",C,",@",26,25,":",17,",@",28,"@",29,27,":",C,",@",32,"@",29,30,":i32,@",34,"@",29,33,":i32,@",36,"@",29,35,":",C,",@",38,"@",29,37,":",C,",@",40,"@",29,39,":",C,",@",42,"@",29,41,":",C,",@",44,"@",29,43,":",C,",@",46,"@",29,45,":",C,",};@",9," fn ",3,"(@",50,"(",9,"_index)",9,"Index:u32,@",13,12,":u32,)->",2,"{var v=",0,"(",9,"Index,",12,");return ",2,"(v.",14,",v.uv,v.textureUV,v.textureST,v.clipUV,v.sdfUV,v.sdfConfig,v.repeat,v.mode,v.shape,v.radius,v.border,",1,"(v.stroke),",1,"(v.fill),v.scissor,);}\n"]).join(''),
  hash: 0x1f9d4aa56de500,
  table,
  shake: [[42,[0,3]],[86,[1,3]],[152,[2,3]],[827,[3]]],
  tree: decompressAST([[1,0,41],[1,42,85],[4,44,110,1],[1,0,9],[1,10,15],[2,9,21],[0,47,721],[2,7,19],[3,13,31],[3,37,49],[3,29,41],[3,36,48],[3,36,48],[3,33,45],[3,32,44],[3,12,30],[3,42,54],[3,12,30],[3,33,45],[3,12,30],[3,31,43],[3,12,30],[3,38,50],[3,12,30],[3,39,52],[3,13,31],[3,39,52],[3,13,31],[3,39,52],[3,13,31],[3,37,50],[3,13,31],[0,42,385],[3,0,7],[2,11,15],[3,5,27],[3,38,62],[2,45,57],[2,19,28],[2,44,56],[2,124,136],[2,23,35]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
//# sourceMappingURL=virtual-ui.wgsl.js.map
