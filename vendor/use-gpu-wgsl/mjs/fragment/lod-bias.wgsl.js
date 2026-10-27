/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture getLODBias getLODBiasedTexture link vec2<f32> f32 optional export".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([3]),[P]:[{[N]:"u",[T]:_(4)},{[N]:"b",[T]:_(5)}]}},{[A]:51,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(5),[Z]:_([6,3])}}],[E]:[{[A]:100,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([7]),[P]:[{[N]:"u",[T]:_(4)}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "fragment/lod-bias",
  code: _(["@",3," fn ",0,"(u:",4,",b:f32)->",C,"{}@",6," @",3," fn ",1,"()->f32{return 0.0;}@",7," fn ",1,"edTexture(u:",4,")->",C,"{return ",0,"(u,",1,"());};\n"]).join(''),
  hash: 0x301215ebe60d1,
  table,
  shake: [[0,[0,2]],[51,[1,2]],[100,[2]]],
  tree: decompressAST([[1,0,51],[4,51,100,1],[1,0,9],[1,10,15],[2,9,19],[0,30,120],[1,0,7],[2,11,30],[2,51,61],[2,13,23]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getLODBiasedTexture = getSymbol("getLODBiasedTexture");
//# sourceMappingURL=lod-bias.wgsl.js.map
