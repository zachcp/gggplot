/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture getIndex loadTextureIndexLevel infer(T) link vec2<u32> u32 optional export infers".split(' '));
const table = {[S]:_(["T",0,1,2]),[W]:_([2]),[X]:[{[A]:14,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([3])},[Z]:_([4]),[P]:[{[N]:"i",[T]:_(5)},{[N]:"_1",[T]:_(6)},{[N]:"l",[T]:_(6)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:72,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(6),[Z]:_([7,4])}}],[E]:[{[A]:119,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:"T",[Z]:_([8]),[P]:[{[N]:"i",[T]:_(5)},{[N]:"l",[T]:_(6)}],[I]:_(["T",0,1])}}],[_(9)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "texture/level-index",
  code: _(["@infer ",T," T;@",4," fn ",0,"(i:",5,",_1:u32,l:u32)->@",3,"T;@",7," @",4," fn ",1,"()->u32{return 0u;};@",8," fn ",2,"(i:",5,",l:u32)->T{return ",0,"(i,",1,"(),l);};\n"]).join(''),
  hash: 0x15a5693611e458,
  table,
  shake: [[0,[0,1,3]],[14,[1,3]],[72,[2,3]],[119,[3]]],
  tree: decompressAST([[1,0,14],[1,14,71],[4,58,104,2],[1,0,9],[1,10,15],[2,9,17],[0,28,118],[1,0,7],[2,11,32],[2,42,43],[2,9,19],[2,13,21]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const loadTextureIndexLevel = getSymbol("loadTextureIndexLevel");
//# sourceMappingURL=level-index.wgsl.js.map
