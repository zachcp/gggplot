/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture getGain TAU getEquiToCubeSample optional link vec2<f32> f32 export return".split(' '));
const table = {[S]:_([0,1,"PI",2,3]),[W]:_([3]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([4,5]),[P]:[{[N]:"u",[T]:_(6)},{[N]:"s",[T]:_(7)}]}},{[A]:84,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(7),[Z]:_([4,5])}}],[E]:[{[A]:176,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([8]),[P]:[{[N]:"u",[T]:D},{[N]:"s",[T]:_(7)}],[I]:_([2,"PI",0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "sample/equi-to-cube",
  code: _(["@",4," @",5," fn ",0,"(u:",6,",s:f32)->",C,"{",9," ",C,"(0.0);};@",4," @",5," fn ",1,"()->f32{",9," 1.0;};const PI=3.1415926536;const TAU=6.2831853072;@",8," fn ",3,"(u:",D,",s:f32)->",C,"{let p=atan2(u.z,u.x);let t=atan2(u.y,length(u.xz));let _1=fract(p/TAU);let v=fract(-t/PI+.5);",9," ",0,"(",6,"(_1,v),s)*",1,"();}\n"]).join(''),
  hash: 0x108c8158a1f526,
  table,
  shake: [[0,[0,4]],[84,[1,4]],[131,[2,4]],[153,[3,4]],[176,[4]]],
  tree: decompressAST([[4,0,83,0],[1,0,9],[1,10,15],[2,9,19],[4,65,111,1],[1,0,9],[1,10,15],[2,9,16],[0,28,50],[2,6,8],[0,16,39],[2,6,9],[0,17,219],[1,0,7],[2,11,30],[2,116,119],[2,20,22],[2,14,24],[2,30,37]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getEquiToCubeSample = getSymbol("getEquiToCubeSample");
//# sourceMappingURL=equi-to-cube.wgsl.js.map
