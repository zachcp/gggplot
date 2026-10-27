/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getInstanceSize getInstanceRepeatIndex u32 link vec2<u32> export".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3])}}],[E]:[{[A]:34,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"v",[T]:_(2)},{[N]:"i",[T]:_(2)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "index/repeat",
  code: _(["@",3," fn ",0,"()->u32{};@",5," fn ",1,"(v:u32,i:u32)->",4,"{var e:u32;var u:u32;let s=",0,"();e=i % s;u=i/s;return ",4,"(e,u);};\n"]).join(''),
  hash: 0x1d1cb45a859f02,
  table,
  shake: [[0,[0,1]],[34,[1]]],
  tree: decompressAST([[1,0,33],[0,34,173],[1,0,7],[2,11,33],[2,73,88]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getInstanceRepeatIndex = getSymbol("getInstanceRepeatIndex");
//# sourceMappingURL=repeat.wgsl.js.map
