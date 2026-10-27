/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture getTextureColor optional link vec2<f32> export".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([2,3]),[P]:[{[N]:"u",[T]:_(4)}]}}],[E]:[{[A]:90,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([5]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "mask/textured",
  code: _(["@",2," @",3," fn ",0,"(u:",4,")->",C,"{return ",C,"(1.0,1.0,1.0,1.0);};@",5," fn ",0,"Color(c:",C,",u:",C,",s:",C,")->",C,"{return c*",0,"(u.xy);}\n"]).join(''),
  hash: 0x11a811fb379e92,
  table,
  shake: [[0,[0,1]],[90,[1]]],
  tree: decompressAST([[4,0,89,0],[1,0,9],[1,10,15],[2,9,19],[0,71,173],[1,0,7],[2,11,26],[2,73,83]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getTextureColor = getSymbol("getTextureColor");
//# sourceMappingURL=textured.wgsl.js.map
