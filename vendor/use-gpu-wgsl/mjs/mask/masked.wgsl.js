/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getMask getMaskedColor f32 optional link vec2<f32> export".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3,4]),[P]:[{[N]:"u",[T]:_(5)}]}}],[E]:[{[A]:58,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([6]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "mask/masked",
  code: _(["@",3," @",4," fn ",0,"(u:",5,")->f32{return 1.0;};@",6," fn ",0,"edColor(c:",C,",u:",C,",s:",C,",)->",C,"{let m=",0,"(u.xy);return ",C,"(c.xyz,c.a*m);}\n"]).join(''),
  hash: 0x12ae6b812204b2,
  table,
  shake: [[0,[0,1]],[58,[1]]],
  tree: decompressAST([[4,0,57,0],[1,0,9],[1,10,15],[2,9,16],[0,39,165],[1,0,7],[2,11,25],[2,70,77]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getMaskedColor = getSymbol("getMaskedColor");
//# sourceMappingURL=masked.wgsl.js.map
