/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getFragment main link vec2<f32> i32 _10 _11 _12 location(0) fragment fragUV fragTextureUV location(1) fragTextureST location(2) fragClipUV location(3) fragSDFUV location(4) fragSDFConfig location(5) interpolate(flat) fragRepeat location(6) fragMode location(7) fragShape location(8) fragRadius location(9) fragBorder location(10) fragStroke location(11) fragFill location(12) fragScissor location(13) location interpolate".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([2]),[P]:[{[N]:"f",[T]:_(3)},{[N]:"_1",[T]:_(3)},{[N]:"_2",[T]:_(3)},{[N]:"_3",[T]:_(3)},{[N]:"_4",[T]:C},{[N]:"_5",[T]:_(4)},{[N]:"_6",[T]:_(4)},{[N]:"_7",[T]:C},{[N]:"_8",[T]:C},{[N]:"_9",[T]:C},{[N]:_(5),[T]:C},{[N]:_(6),[T]:C},{[N]:_(7),[T]:C}]}}],[E]:[{[A]:195,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:{[N]:C,[Z]:_([8])},[Z]:_([9]),[P]:[{[N]:_(10),[T]:_(3),[Z]:_([8])},{[N]:_(11),[T]:_(3),[Z]:_([12])},{[N]:_(13),[T]:_(3),[Z]:_([14])},{[N]:_(15),[T]:C,[Z]:_([16])},{[N]:_(17),[T]:_(3),[Z]:_([18])},{[N]:_(19),[T]:C,[Z]:_([20,21])},{[N]:_(22),[T]:_(4),[Z]:_([23,21])},{[N]:_(24),[T]:_(4),[Z]:_([25,21])},{[N]:_(26),[T]:C,[Z]:_([27,21])},{[N]:_(28),[T]:C,[Z]:_([29,21])},{[N]:_(30),[T]:C,[Z]:_([31,21])},{[N]:_(32),[T]:C,[Z]:_([33,21])},{[N]:_(34),[T]:C,[Z]:_([35,21])},{[N]:_(36),[T]:C,[Z]:_([37,21])}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "fragment/ui",
  code: _(["@",2," fn ",0,"(f:",3,",_1:",3,",_2:",3,",_3:",3,",_4:",C,",_5:i32,_6:i32,_7:",C,",_8:",C,",_9:",C,",_10:",C,",_11:",C,",_12:",C,",)->",C,"{};@",9," fn ",1,"(@",8,10,":",3,",@",12,11,":",3,",@",14,13,":",3,",@",16,15,":",C,",@",18,17,":",3,",@",20,"@",21,19,":",C,",@",23,"@",21,22,":i32,@",25,"@",21,24,":i32,@",27,"@",21,26,":",C,",@",29,"@",21,28,":",C,",@",31,"@",21,30,":",C,",@",33,"@",21,32,":",C,",@",35,"@",21,34,":",C,",@",37,"@",21,36,":",C,",)->@",8,C,"{let o=",0,"(",10,",",11,",",13,",",15,",",17,",",19,",",22,",",24,",",26,",",28,",",30,",",32,",",34,",",36,",);if(HAS_ALPHA_TO_DISCARD){if(o.a<=0.0){discard;}}return o;}\n"]).join(''),
  hash: 0x2839a3cb45322,
  table,
  shake: [[0,[0,1]],[195,[1]]],
  tree: decompressAST([[1,0,194],[0,195,1086],[3,0,9],[2,13,17],[3,5,17],[3,29,41],[3,36,48],[3,36,48],[3,33,45],[3,32,44],[3,12,30],[3,42,54],[3,12,30],[3,33,45],[3,12,30],[3,31,43],[3,12,30],[3,38,50],[3,12,30],[3,39,52],[3,13,31],[3,39,52],[3,13,31],[3,39,52],[3,13,31],[3,37,50],[3,13,31],[3,43,55],[2,28,39]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
//# sourceMappingURL=ui.wgsl.js.map
