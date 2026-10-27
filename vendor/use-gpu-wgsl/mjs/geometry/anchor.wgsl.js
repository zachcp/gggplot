/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getLineDetail getAnchorStart getAnchorEnd getLineAnchor i32 optional link vec4<u32> export u32 optional return".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(4),[Z]:_([5,6])}},{[A]:67,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(4),[Z]:_([5,6])}},{[A]:129,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(4),[Z]:_([5,6])}}],[E]:[{[A]:187,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(7),[Z]:_([8]),[P]:[{[N]:"i",[T]:_(9)}],[I]:_([1,2,0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "geometry/anchor",
  code: _(["@",5," @",6," fn ",0,"()->i32{",11," ANCHOR_LINE_DETAIL;}@",5," @",6," fn ",1,"()->i32{",11," ANCHOR_START;}@",5," @",6," fn ",2,"()->i32{",11," ANCHOR_END;}@",8," fn ",3,"(i:u32)->",7,"{let s=",1,"();let e=",2,"();let h=s !=0&&e !=0;var _1=i;var d=0u;if(h){_1=_1>>1u;d=_1&1u;}let n=u32(",0,"()+1);let s1=n*_1;let e1=s1+n-1u;var b=0u;if(h){b=1u;}if(s !=0&&(e==0||d==0u)){",11," ",7,"(s1,s1+1u,e1,b);}if(e !=0&&(s==0||d==1u)){",11," ",7,"(e1,e1-1u,s1,b);}",11," ",7,"(0u,0u,0u,0u);};\n"]).join(''),
  hash: 0x11d73d626471de,
  table,
  shake: [[0,[0,3]],[67,[1,3]],[129,[2,3]],[187,[3]]],
  tree: decompressAST([[4,0,67,0],[1,0,9],[1,10,15],[2,9,22],[4,48,110,1],[1,0,9],[1,10,15],[2,9,23],[4,43,101,2],[1,0,9],[1,10,15],[2,9,21],[0,39,412],[1,0,7],[2,11,24],[2,38,52],[2,23,35],[2,87,100]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getLineAnchor = getSymbol("getLineAnchor");
//# sourceMappingURL=anchor.wgsl.js.map
