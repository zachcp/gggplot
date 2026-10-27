/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../geometry/strip.wgsl";
import m1 from "../use/array.wgsl";
import m2 from "../plot/loop.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSize getPosition getSurfaceNormal @use-gpu/wgsl/geometry/strip getStripIndex @use-gpu/wgsl/use/array sizeToModulus3 packIndex3 unpackIndex3 @use-gpu/wgsl/plot/loop loopSurface vec3<u32> link optional u32 export packIndex3 loopSurface getPosition return".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]},{[A]:0,[N]:_(5),[S]:_([6,7,8]),[K]:[{[N]:_(6),[J]:_(6)},{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)}]},{[A]:0,[N]:_(9),[S]:_([10]),[K]:[{[N]:_(10),[J]:_(10)}]}],[X]:[{[A]:168,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(11),[Z]:_([12])}},{[A]:200,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([13,12]),[P]:[{[N]:"i",[T]:_(14)}]}}],[E]:[{[A]:284,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([15]),[P]:[{[N]:"i",[T]:_(14)}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "plot/surface-normal",
  code: _(["use '",3,"'::{",4,"};use '",5,"'::{",6,",",7,",un",7,"}use '",9,"'::{",10,"};@",12," fn ",0,"()->",11,"{};@",13," @",12," fn ",1,"(i:u32)->",C,"{",19," ",C,"(0.0,0.0,0.0,0.0);}@",15," fn ",2,"(i:u32)->",C,"{let s=",0,"();let m=",6,"(s);let x=un",7,"(i,m);let l=",7,"(",10,"(x,s,vec2<i32>(-1,0)),m);let r=",7,"(",10,"(x,s,vec2<i32>(1,0)),m);let t=",7,"(",10,"(x,s,vec2<i32>(0,-1)),m);let b=",7,"(",10,"(x,s,vec2<i32>(0,1)),m);let d=",1,"(r)-",1,"(l);let d1=",1,"(b)-",1,"(t);let n=",C,"(normalize(cross(d.xyz,d1.xyz)),0.0);if(SURFACE_FLIP){",19,"-n;}else{",19," n;}}\n"]).join(''),
  hash: 0xa5176bf778039,
  table,
  shake: [[168,[0,2]],[200,[1,2]],[284,[2]]],
  tree: decompressAST([[1,0,51],[1,52,123],[1,71,115],[1,45,76],[4,32,116,1],[1,0,9],[1,10,15],[2,9,20],[0,65,553],[1,0,7],[2,11,27],[2,41,48],[2,16,30],[2,24,36],[2,24,34],[2,11,22],[2,42,52],[2,11,22],[2,41,51],[2,11,22],[2,42,52],[2,11,22],[2,41,52],[2,15,26],[2,22,33],[2,15,26]], table[S]),
};

const libs = {"@use-gpu/wgsl/geometry/strip": m0, "@use-gpu/wgsl/use/array": m1, "@use-gpu/wgsl/plot/loop": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getSurfaceNormal = getSymbol("getSurfaceNormal");
//# sourceMappingURL=surface-normal.wgsl.js.map
