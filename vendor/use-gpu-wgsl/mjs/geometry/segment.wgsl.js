/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getLineDetail getLineSegment i32 optional link export u32 return".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3,4])}}],[E]:[{[A]:68,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(2),[Z]:_([5]),[P]:[{[N]:"i",[T]:_(6)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "geometry/segment",
  code: _(["@",3," @",4," fn ",0,"()->i32{",7," SEGMENT_LINE_DETAIL;}@",5," fn ",1,"(i:u32)->i32{let n=u32(",0,"()+1);let _1=i % n;if(_1==0u){",7," 1;}if(_1==n-1u){",7," 2;}",7," 3;};\n"]).join(''),
  hash: 0x1011b816b44519,
  table,
  shake: [[0,[0,1]],[68,[1]]],
  tree: decompressAST([[4,0,68,0],[1,0,9],[1,10,15],[2,9,22],[0,49,183],[1,0,7],[2,11,25],[2,37,50]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getLineSegment = getSymbol("getLineSegment");
//# sourceMappingURL=segment.wgsl.js.map
