/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getDispatchSize getStep getTrim arcLengthBuffer main u32 link vec2<u32> array<f32> <storage,read_write> void compute workgroup_size(64) export globalId vec3<u32> builtin(global_invocation_id) arcLengthBuffer globalId".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([4]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6])}},{[A]:32,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(5),[Z]:_([6])}},{[A]:56,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(7),[Z]:_([6]),[P]:[{[N]:"i",[T]:_(5)}]}},{[A]:91,[R]:_(3),[G]:2,[V]:{[N]:_(3),[T]:_(8),[Z]:_([6]),[Q]:_(9)}}],[E]:[{[A]:147,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(10),[Z]:_([11,12,13]),[P]:[{[N]:_(14),[T]:_(15),[Z]:_([16])}],[I]:_([0,2,1,3])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "compute/arc-prefix-sum",
  code: _(["@",6," fn ",0,"()->u32;@",6," fn ",1,"()->u32;@",6," fn ",2,"(i:u32)->",7,";@",6," var",9,3,":",8,";@",11," @",12,"@",13," fn ",4,"(@",16,14,":",15,",){let d=",0,"();if(",14,".x>=d){return;}let i=",14,".x;let s=",2,"(i).x;let _1=i-s;let s1=",1,"();let m=(_1>>s1)&1u;if(m !=0){let b=s+((_1>>(s1+1u))<<(s1+1u));let s2=(1u<<s1)-1u;",3,"[i]=",3,"[i]+",3,"[b+s2];}}\n"]).join(''),
  hash: 0x1fe9f48d0f1c43,
  table,
  shake: [[0,[0,4]],[32,[1,4]],[56,[2,4]],[91,[3,4]],[147,[4]]],
  tree: decompressAST([[1,0,31],[1,32,55],[1,24,58],[1,35,91],[0,56,407],[3,0,8],[3,9,28],[1,19,26],[2,11,15],[3,5,35],[2,57,72],[2,67,74],[2,31,38],[2,90,105],[2,19,34],[2,19,34]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const main = getSymbol("main");
//# sourceMappingURL=arc-prefix-sum.wgsl.js.map
