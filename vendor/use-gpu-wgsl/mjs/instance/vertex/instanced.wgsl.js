/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex loadInstance getMappedInstance getInstancedVertex infer(T) link u32 void vec2<u32> optional export infers".split(' '));
const table = {[S]:_(["T",0,1,2,3]),[W]:_([3]),[X]:[{[A]:14,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([4])},[Z]:_([5]),[P]:[{[N]:"v",[T]:_(6)},{[N]:"i",[T]:_(6)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:58,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(7),[Z]:_([5]),[P]:[{[N]:"i",[T]:_(6)}]}},{[A]:89,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(8),[Z]:_([9,5]),[P]:[{[N]:"v",[T]:_(6)},{[N]:"i",[T]:_(6)}]}}],[E]:[{[A]:174,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:"T",[Z]:_([10]),[P]:[{[N]:"v",[T]:_(6)},{[N]:"i",[T]:_(6)}],[I]:_(["T",2,1,0])}}],[_(11)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "vertex/instanced",
  code: _(["@infer ",T," T;@",5," fn ",0,"(v:u32,i:u32)->@",4,"T;@",5," fn ",1,"(i:u32){};@",9," @",5," fn ",2,"(v:u32,i:u32)->",8,"{return ",8,"(i,i);};@",10," fn ",3,"(v:u32,i:u32)->T{var e:u32;if(HAS_INSTANCES){let m=",2,"(v,i);e=m.x;let u=m.y;",1,"(u);}else{e=i;}return ",0,"(v,e);};\n"]).join(''),
  hash: 0x3995d4db04d0c,
  table,
  shake: [[0,[0,1,4]],[14,[1,4]],[58,[2,4]],[89,[3,4]],[174,[4]]],
  tree: decompressAST([[1,0,14],[1,14,57],[1,44,74],[4,31,115,3],[1,0,9],[1,10,15],[2,9,26],[0,66,235],[1,0,7],[2,11,29],[2,33,34],[2,36,53],[2,39,51],[2,34,43]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getInstancedVertex = getSymbol("getInstancedVertex");
//# sourceMappingURL=instanced.wgsl.js.map
