/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getScissorMin getScissorMax getScissorBias getScissorBox link f32 export".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([4])}},{[A]:36,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:C,[Z]:_([4])}},{[A]:72,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(5),[Z]:_([4])}}],[E]:[{[A]:103,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([6]),[P]:[{[N]:"v",[T]:C}],[I]:_([0,1,2])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "scissor/scissor-box",
  code: _(["@",4," fn ",0,"()->",C,";@",4," fn ",1,"()->",C,";@",4," fn ",2,"()->f32;@",6," fn ",3,"(v:",C,")->",C,"{let s=",0,"();let s1=",1,"();let b=",2,"();let v1=v-s;let v2=s1-v;return min(v1,v2)+b;};\n"]).join(''),
  hash: 0x1ef25460bf3cfb,
  table,
  shake: [[0,[0,3]],[36,[1,3]],[72,[2,3]],[103,[3]]],
  tree: decompressAST([[1,0,35],[1,36,71],[1,36,66],[0,31,192],[1,0,7],[2,11,24],[2,44,57],[2,23,36],[2,22,36]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getScissorBox = getSymbol("getScissorBox");
//# sourceMappingURL=scissor-box.wgsl.js.map
