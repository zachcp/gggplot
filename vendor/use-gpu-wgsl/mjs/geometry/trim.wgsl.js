/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getLineDetail getAnchorStart getAnchorEnd getLineTrim i32 optional link vec4<u32> export u32 optional return".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(4),[Z]:_([5,6])}},{[A]:67,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(4),[Z]:_([5,6])}},{[A]:129,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(4),[Z]:_([5,6])}}],[E]:[{[A]:187,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(7),[Z]:_([8]),[P]:[{[N]:"i",[T]:_(9)}],[I]:_([1,2,0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "geometry/trim",
  code: _(["@",5," @",6," fn ",0,"()->i32{",11," ANCHOR_LINE_DETAIL;}@",5," @",6," fn ",1,"()->i32{",11," ANCHOR_START;}@",5," @",6," fn ",2,"()->i32{",11," ANCHOR_END;}@",8," fn ",3,"(i:u32)->",7,"{let s=",1,"();let e=",2,"();let n=u32(",0,"()+1);let _1=i/n;let d=i % n;let s1=_1*n;let e1=s1+n-1u;var b=0u;if(s !=0){b+=1u;}if(e !=0){b+=2u;}",11," ",7,"(s1,e1,b,0u);};\n"]).join(''),
  hash: 0xb0eacab745cc2,
  table,
  shake: [[0,[0,3]],[67,[1,3]],[129,[2,3]],[187,[3]]],
  tree: decompressAST([[4,0,67,0],[1,0,9],[1,10,15],[2,9,22],[4,48,110,1],[1,0,9],[1,10,15],[2,9,23],[4,43,101,2],[1,0,9],[1,10,15],[2,9,21],[0,39,276],[1,0,7],[2,11,22],[2,36,50],[2,23,35],[2,25,38]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getLineTrim = getSymbol("getLineTrim");
//# sourceMappingURL=trim.wgsl.js.map
