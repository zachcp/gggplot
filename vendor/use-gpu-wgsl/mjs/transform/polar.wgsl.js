/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTransformMatrix getPolarBend getPolarFocus getPolarAspect getPolarHelix getPolarPosition mat4x4<f32> link f32 optional export optional return".split(' '));
const table = {[S]:_([0,1,2,3,4,5]),[W]:_([5]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(6),[Z]:_([7])}},{[A]:43,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(8),[Z]:_([9,7])}},{[A]:95,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(8),[Z]:_([9,7])}},{[A]:148,[R]:_(3),[G]:6,[F]:{[N]:_(3),[T]:_(8),[Z]:_([9,7])}},{[A]:202,[R]:_(4),[G]:6,[F]:{[N]:_(4),[T]:_(8),[Z]:_([9,7])}}],[E]:[{[A]:255,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:C,[Z]:_([10]),[P]:[{[N]:"p",[T]:C}],[I]:_([1,2,3,4,0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true}};
const data = {
  name: "transform/polar",
  code: _(["@",7," fn ",0,"()->",6,";@",9," @",7," fn ",1,"()->f32{",12," 0.0;};@",9," @",7," fn ",2,"()->f32{",12," 0.0;};@",9," @",7," fn ",3,"()->f32{",12," 1.0;};@",9," @",7," fn ",4,"()->f32{",12," 0.0;};@",10," fn ",5,"(p:",C,")->",C,"{let p1=",1,"();let p2=",2,"();let p3=",3,"();let p4=",4,"();let m=",0,"();if(p1>0.0){if(p1<0.001){let p5=p.xy*p1;let p6=p5.x*p5.x;",12," m*vec4(p.x*(1.0-p1+(p5.y*p3)),p.y*(1.0-.5*p6)-(.5*p6)*p2/p3,p.z+p.x*p4*p1,1.0);}else{let x=p.xy*vec2<f32>(p1,p3);let r=p2+x.y;",12," m*",C,"(sin(x.x)*r,(cos(x.x)*r-p2)/p3,p.z+p.x*p4*p1,1.0);}}",12," m*",C,"(p.xyz,1.0);}\n"]).join(''),
  hash: 0xbcd1118608497,
  table,
  shake: [[0,[0,5]],[43,[1,5]],[95,[2,5]],[148,[3,5]],[202,[4,5]],[255,[5]]],
  tree: decompressAST([[1,0,42],[4,43,94,1],[1,0,9],[1,10,15],[2,9,21],[4,33,85,2],[1,0,9],[1,10,15],[2,9,22],[4,34,87,3],[1,0,9],[1,10,15],[2,9,23],[4,35,87,4],[1,0,9],[1,10,15],[2,9,22],[0,34,495],[1,0,7],[2,11,27],[2,48,60],[2,22,35],[2,23,37],[2,24,37],[2,22,40]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getPolarPosition = getSymbol("getPolarPosition");
//# sourceMappingURL=polar.wgsl.js.map
