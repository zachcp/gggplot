/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getAlbedo getTexture getColor optional link vec2<f32> export return".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([3,4])}},{[A]:77,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([3,4]),[P]:[{[N]:"u",[T]:_(5)}]}}],[E]:[{[A]:154,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([6]),[P]:[{[N]:"i",[T]:C},{[N]:"m",[T]:C},{[N]:"m1",[T]:C}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "mask/color",
  code: _(["@",3," @",4," fn ",0,"()->",C,"{",7," ",C,"(1.0,1.0,1.0,1.0);}@",3," @",4," fn ",1,"(u:",5,")->",C,"{",7," ",C,"(0.0);}@",6," fn ",2,"(i:",C,",m:",C,",m1:",C,",)->",C,"{var c:",C,"=i*",0,"();if(HAS_COLOR_MAP){c*=",1,"(m.xy);}",7," c;}\n"]).join(''),
  hash: 0xc48a3110401cd,
  table,
  shake: [[0,[0,2]],[77,[1,2]],[154,[2]]],
  tree: decompressAST([[4,0,77,0],[1,0,9],[1,10,15],[2,9,18],[4,58,135,1],[1,0,9],[1,10,15],[2,9,19],[0,58,207],[1,0,7],[2,11,19],[2,77,86],[2,33,43]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getColor = getSymbol("getColor");
//# sourceMappingURL=color.wgsl.js.map
