/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getOffset getSize getInterleaveIndex u32 optional link export return".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(3),[Z]:_([4,5])}},{[A]:48,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(3),[Z]:_([4,5])}}],[E]:[{[A]:94,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(3),[Z]:_([6]),[P]:[{[N]:"i",[T]:_(3)}],[I]:_([1,0])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "index/interleave",
  code: _(["@",4," @",5," fn ",0,"()->u32{",7," 0u;};@",4," @",5," fn ",1,"()->u32{",7," 1u;};@",6," fn ",2,"(i:u32)->u32{",7," i*",1,"()+",0,"();}\n"]).join(''),
  hash: 0x1037ed46bfb6ff,
  table,
  shake: [[0,[0,2]],[48,[1,2]],[94,[2]]],
  tree: decompressAST([[4,0,47,0],[1,0,9],[1,10,15],[2,9,18],[4,29,74,1],[1,0,9],[1,10,15],[2,9,16],[0,27,101],[1,0,7],[2,11,29],[2,40,47],[2,10,19]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getInterleaveIndex = getSymbol("getInterleaveIndex");
//# sourceMappingURL=interleave.wgsl.js.map
