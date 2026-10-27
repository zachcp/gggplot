/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getDispatchSize getPosition getTrim arcLengthBuffer main u32 link vec2<u32> array<f32> <storage,read_write> void compute workgroup_size(64) export globalId vec3<u32> builtin(global_invocation_id) getPosition globalId".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([4]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6])}},{[A]:32,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:C,[Z]:_([6]),[P]:[{[N]:"i",[T]:_(5)}]}},{[A]:71,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(7),[Z]:_([6]),[P]:[{[N]:"i",[T]:_(5)}]}},{[A]:106,[R]:_(3),[G]:2,[V]:{[N]:_(3),[T]:_(8),[Z]:_([6]),[Q]:_(9)}}],[E]:[{[A]:162,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(10),[Z]:_([11,12,13]),[P]:[{[N]:_(14),[T]:_(15),[Z]:_([16])}],[I]:_([0,2,1,3])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "compute/arc-length",
  code: _(["@",6," fn ",0,"()->u32;@",6," fn ",1,"(i:u32)->",C,";@",6," fn ",2,"(i:u32)->",7,";@",6," var",9,3,":",8,";@",11," @",12,"@",13," fn ",4,"(@",16,14,":",15,",){let d=",0,"();if(",14,".x>=d){return;}let i=",14,".x;let s=",2,"(i).x;let _1=select(i,i-1,i>s);let a=",1,"(i);let b=",1,"(_1);",3,"[i]=length(b-a);}\n"]).join(''),
  hash: 0x10f74810e023cf,
  table,
  shake: [[0,[0,4]],[32,[1,4]],[71,[2,4]],[106,[3,4]],[162,[4]]],
  tree: decompressAST([[1,0,31],[1,32,70],[1,39,73],[1,35,91],[0,56,337],[3,0,8],[3,9,28],[1,19,26],[2,11,15],[3,5,35],[2,57,72],[2,67,74],[2,44,55],[2,21,32],[2,16,31]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
//# sourceMappingURL=arc-length.wgsl.js.map
