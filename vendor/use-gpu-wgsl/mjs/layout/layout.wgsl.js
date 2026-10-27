/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getFlip getOffset getLayoutPosition vec2<f32> link export".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(3),[Z]:_([4])}},{[A]:30,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(3),[Z]:_([4])}}],[E]:[{[A]:62,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([5]),[P]:[{[N]:"p",[T]:C}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "layout/layout",
  code: _(["@",4," fn ",0,"()->",3,";@",4," fn ",1,"()->",3,";@",5," fn ",2,"(p:",C,")->",C,"{let f=",0,"();let o=",1,"();var x=select(p.xy,f-p.xy,f>",3,"(0.0));return ",C,"(x+o,p.zw);}\n"]).join(''),
  hash: 0x1d7e2243465fdf,
  table,
  shake: [[0,[0,2]],[30,[1,2]],[62,[2]]],
  tree: decompressAST([[1,0,29],[1,30,61],[0,32,190],[1,0,7],[2,11,28],[2,48,55],[2,16,25]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getLayoutPosition = getSymbol("getLayoutPosition");
//# sourceMappingURL=layout.wgsl.js.map
