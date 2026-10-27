/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getNorm displayFloat f32 optional link export".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3,4])}}],[E]:[{[A]:47,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([5]),[P]:[{[N]:"s",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "display/float",
  code: _(["@",3," @",4," fn ",0,"()->f32{return 1.0;};@",5," fn ",1,"(s:",C,")->",C,"{return select(-s*.333,s,s>",C,"(0.0))*",0,"();};\n"]).join(''),
  hash: 0x40bd57a863b97,
  table,
  shake: [[0,[0,1]],[47,[1]]],
  tree: decompressAST([[4,0,46,0],[1,0,9],[1,10,15],[2,9,16],[0,28,129],[1,0,7],[2,11,23],[2,79,86]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const displayFloat = getSymbol("displayFloat");
//# sourceMappingURL=float.wgsl.js.map
