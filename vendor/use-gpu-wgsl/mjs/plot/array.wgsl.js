/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../use/array.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSize unpackIndex packIndex @use-gpu/wgsl/use/array sizeToModulus4 packIndex4 unpackIndex4 vec4<u32> link export u32 sizeToModulus4 getSize".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([1,2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4,5,6]),[K]:[{[N]:_(4),[J]:_(4)},{[N]:_(5),[J]:_(5)},{[N]:_(6),[J]:_(6)}]}],[X]:[{[A]:71,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(7),[Z]:_([8])}}],[E]:[{[A]:103,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(7),[Z]:_([9]),[P]:[{[N]:"i",[T]:_(10)}],[I]:_([0])}},{[A]:210,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(10),[Z]:_([9]),[P]:[{[N]:"v",[T]:_(7)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "plot/array",
  code: _(["use '",3,"'::{",4,",",2,"4,",1,"4}@",8," fn ",0,"()->",7,"{};@",9," fn ",1,"(i:u32)->",7,"{let s=",0,"();let m=",4,"(s);return ",1,"4(i,m);}@",9," fn ",2,"(v:",7,")->u32{let s=",0,"();let m=",4,"(s);return ",2,"4(v,m);}\n"]).join(''),
  hash: 0x17895d35798532,
  table,
  shake: [[71,[0,1,2]],[103,[1]],[210,[2]]],
  tree: decompressAST([[1,0,71],[1,71,102],[0,32,139],[1,0,7],[2,11,22],[2,36,43],[2,16,30],[2,25,37],[0,19,122],[1,0,7],[2,11,20],[2,34,41],[2,16,30],[2,25,35]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/array": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const unpackIndex = getSymbol("unpackIndex");
export const packIndex = getSymbol("packIndex");
//# sourceMappingURL=array.wgsl.js.map
