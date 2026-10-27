/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("toF16u fromF16u toF16u4 fromF16u4 u32 export f32 vec2<u32> export toF16u select return fromF16u".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([0,1,2,3]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"v",[T]:_(6)}]}},{[A]:363,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(6),[Z]:_([5]),[P]:[{[N]:"h",[T]:_(4)}]}},{[A]:712,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(7),[Z]:_([5]),[P]:[{[N]:"v",[T]:C}],[I]:_([0])}},{[A]:853,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([5]),[P]:[{[N]:"v",[T]:_(7)}],[I]:_([1])}}]};
const data = {
  name: "codec/f16",
  code: _(["@",5," fn ",0,"(v:f32)->u32{let s=",10,"(0u,0x80000000u,v<0.0);let f=frexp(v);var e=i32(f.exp);if(e<-14){let m=u32(round(abs(f.fract)*0x400))>>u32(-14-e);",11," ",10,"(s|m,s|(1<<10u),m==0x400);}else if(e<=15){let m=u32(round(abs(f.fract)*0x800));",11," ",10,"(s|(u32(e+14)<<10u)|(m&0x3FFu),s|(u32(e+15)<<10u)|((m&0x7FFu)>>1u),m==0x800);}else{",11," s|0x7C00;}};@",5," fn ",1,"(h:u32)->f32{let s=vec3<u32>(0x8000,0x7C00,0x3FF)&vec3<u32>(h);let s1=s.x<<16u;let e=s.y;let m=s.z;let l=firstLeadingBit(m);let f=(",10,"(0u,",10,"(",10,"(s1|((103u+l)<<23u)|((m<<(23u-l))&0x7FFFFFu),s1|((e+0x1C000u)<<13u)|(m<<13u),e !=0,),",10,"(s1|0x7F800000u,0x7FC00000u,m !=0u),e==0x7C00u),(e|m)!=0u));",11," bitcast<f32>(f);};@",5," fn ",0,"4(v:",C,")->",7,"{",11,"(",7,"(",0,"(v.x),",0,"(v.z))|(",7,"(",0,"(v.y),",0,"(v.w))<<",7,"(16u)));};@",5," fn ",1,"4(v:",7,")->",C,"{let x=v.xy&",7,"(0xFFFFu);let y=v.xy>>",7,"(16u);",11," ",C,"(",1,"(x.x),",1,"(y.x),",1,"(x.y),",1,"(y.y),);};\n"]).join(''),
  hash: 0x3cf49f57b0a47,
  table,
  shake: [[0,[0,2]],[363,[1,3]],[712,[2]],[853,[3]]],
  tree: decompressAST([[0,0,362],[1,0,7],[2,11,17],[0,352,700],[1,0,7],[2,11,19],[0,338,478],[1,0,7],[2,11,18],[2,49,55],[2,12,18],[2,24,30],[2,12,18],[0,33,211],[1,0,7],[2,11,20],[2,108,116],[2,14,22],[2,14,22],[2,14,22]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.toF16u = getSymbol("toF16u");
exports.fromF16u = getSymbol("fromF16u");
exports.toF16u4 = getSymbol("toF16u4");
exports.fromF16u4 = getSymbol("fromF16u4");
//# sourceMappingURL=f16.wgsl.js.map
