/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("ONE_TWO bayer2x2 bayer4x4 bayer2x2f bayer4x4f u32 export vec2<u32> f32 ONE_TWO export return".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([1,2,3,4]),[E]:[{[A]:29,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"i",[T]:_(7)}]}},{[A]:141,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"i",[T]:_(7)}],[I]:_([0])}},{[A]:333,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(8),[Z]:_([6]),[P]:[{[N]:"i",[T]:_(7)}],[I]:_([1])}},{[A]:406,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(8),[Z]:_([6]),[P]:[{[N]:"i",[T]:_(7)}],[I]:_([2])}}]};
const data = {
  name: "fragment/bayer",
  code: _(["const ",0,"=",7,"(1,2);@",6," fn ",1,"(i:",7,")->u32{let _1=i&",7,"(0x1u);let x=_1.x;let x1=_1.x ^ _1.y;",11,"(x|(x1<<1));}@",6," fn ",2,"(i:",7,")->u32{let _1=i&",7,"(0x3u);let x=_1.x;let x1=_1.x ^ _1.y;let x2=",7,"(x)&",0,";let x3=",7,"(x1)&",0,";",11,"(x3.x<<3)|(x2.x<<2)|x3.y|(x2.y>>1);}@",6," fn ",1,"f(i:",7,")->f32{",11,"(0.5+f32(",1,"(i)))/4.0;}@",6," fn ",2,"f(i:",7,")->f32{",11,"(0.5+f32(",2,"(i)))/16.0;}\n"]).join(''),
  hash: 0x917262ddd5fb7,
  table,
  shake: [[0,[0,2,4]],[29,[1,3]],[141,[2,4]],[333,[3]],[406,[4]]],
  tree: decompressAST([[0,0,29],[2,6,13],[0,23,135],[1,0,7],[2,11,19],[0,101,293],[1,0,7],[2,11,19],[2,102,109],[2,29,36],[0,50,123],[1,0,7],[2,11,20],[2,43,51],[0,19,93],[1,0,7],[2,11,20],[2,43,51]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const bayer2x2 = getSymbol("bayer2x2");
export const bayer4x4 = getSymbol("bayer4x4");
export const bayer2x2f = getSymbol("bayer2x2f");
export const bayer4x4f = getSymbol("bayer4x4f");
//# sourceMappingURL=bayer.wgsl.js.map
