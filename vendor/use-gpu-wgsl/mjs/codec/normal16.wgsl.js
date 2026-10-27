/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../codec/octahedral.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("encodeNormal16 decodeNormal16 encodeNormal16Plus NormalIndex decodePlusOnly decodeNormal16Plus octaToNormal16 octaToNormal @use-gpu/wgsl/codec/octahedral encodeOctahedral decodeOctahedral vec4<u32> export u32 normal index locals encodeOctahedral decodeOctahedral export return NormalIndex".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7]),[W]:_([0,1,2,4,5,6,7]),[O]:[{[A]:0,[N]:_(8),[S]:_([9,10]),[K]:[{[N]:_(9),[J]:_(9)},{[N]:_(10),[J]:_(10)}]}],[E]:[{[A]:74,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"n",[T]:D}]}},{[A]:198,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:D,[Z]:_([12]),[P]:[{[N]:"n",[T]:_(11)}]}},{[A]:312,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"n",[T]:D},{[N]:"i",[T]:_(13)}]}},{[A]:521,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(13),[Z]:_([12]),[P]:[{[N]:"n",[T]:_(11)}]}},{[A]:594,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(3),[Z]:_([12]),[P]:[{[N]:"n",[T]:_(11)}],[I]:_([3,3])}},{[A]:748,[R]:_(6),[G]:1,[F]:{[N]:_(6),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"o",[T]:C}]}},{[A]:851,[R]:_(7),[G]:1,[F]:{[N]:_(7),[T]:D,[Z]:_([12]),[P]:[{[N]:"o",[T]:C}]}}],[_(16)]:[{[A]:473,[R]:_(3),[G]:0,[U]:{[N]:_(3),[M]:[{[N]:_(14),[T]:D},{[N]:_(15),[T]:_(13)}]}}]};
const data = {
  name: "codec/normal16",
  code: _(["use '",8,"'::{",9,",",10,"};@",12," fn ",0,"(n:",D,")->",11,"{let x=",9,"(n)*.5+.5;",20," ",11,"(vec2<u32>(x*255.0),0,0);}@",12," fn ",1,"(n:",11,")->",D,"{let x=vec2<f32>(n.xy)/255.0;",20," ",10,"(x*2.0-1.0);}@",12," fn ",0,"Plus(n:",D,",i:u32)->",11,"{let x=",9,"(n)*.5+.5;let z=vec2<u32>(i>>8,i&0xFF);",20," ",11,"(vec2<u32>(x*255.0),z);}",U," ",3,"{",14,":",D,",",15,":u32,};@",12," fn ",4,"(n:",11,")->u32{let i=(n.z<<8)|n.w;",20," i;}@",12," fn ",1,"Plus(n:",11,")->",3,"{let x=vec2<f32>(n.xy)/255.0;let i=(n.z<<8)|n.w;",20," ",3,"(",10,"(x*2.0-1.0),i);}@",12," fn ",6,"(o:",C,")->",11,"{",20," ",11,"(vec2<u32>((o.xy*.5+.5)*255.0),0,0);}@",12," fn ",7,"(o:",C,")->",D,"{",20," ",10,"(o.xy);}\n"]).join(''),
  hash: 0xa8e34e95aae66,
  table,
  shake: [[74,[0]],[198,[1]],[312,[2]],[473,[3,5]],[521,[4]],[594,[5]],[748,[6]],[851,[7]]],
  tree: decompressAST([[1,0,73],[0,74,198],[1,0,7],[2,11,25],[2,45,61],[0,68,182],[1,0,7],[2,11,25],[2,74,90],[0,29,190],[1,0,7],[2,11,29],[2,55,71],[0,95,142],[2,7,18],[0,41,114],[1,0,7],[2,11,25],[0,62,216],[1,0,7],[2,11,29],[2,33,44],[2,66,77],[2,12,28],[0,32,135],[1,0,7],[2,11,25],[0,92,171],[1,0,7],[2,11,23],[2,44,60]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const encodeNormal16 = getSymbol("encodeNormal16");
export const decodeNormal16 = getSymbol("decodeNormal16");
export const encodeNormal16Plus = getSymbol("encodeNormal16Plus");
export const decodePlusOnly = getSymbol("decodePlusOnly");
export const decodeNormal16Plus = getSymbol("decodeNormal16Plus");
export const octaToNormal16 = getSymbol("octaToNormal16");
export const octaToNormal = getSymbol("octaToNormal");
//# sourceMappingURL=normal16.wgsl.js.map
