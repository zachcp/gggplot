/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/view.wgsl");
const m1 = require("../../use/types.wgsl");
const m2 = require("../../codec/octahedral.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSurface getLight applyLight getDeferredLightFragment @use-gpu/wgsl/use/view getViewPosition clipToWorld to3D @use-gpu/wgsl/use/types Light SurfaceFragment @use-gpu/wgsl/codec/octahedral decodeOctahedral link vec2<f32> u32 export SurfaceFragment".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5,6,7]),[K]:[{[N]:_(5),[J]:_(5)},{[N]:_(6),[J]:_(6)},{[N]:_(7),[J]:_(7)}]},{[A]:0,[N]:_(8),[S]:_([9,10]),[K]:[{[N]:_(9),[J]:_(9)},{[N]:_(10),[J]:_(10)}]},{[A]:0,[N]:_(11),[S]:_([12]),[K]:[{[N]:_(12),[J]:_(12)}]}],[X]:[{[A]:177,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(10),[Z]:_([13]),[P]:[{[N]:"u",[T]:_(14)}]}},{[A]:227,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(9),[Z]:_([13]),[P]:[{[N]:"i",[T]:_(15)}]}},{[A]:259,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:D,[Z]:_([13]),[P]:[{[N]:"N",[T]:D},{[N]:"V",[T]:D},{[N]:"l",[T]:_(9)},{[N]:"s",[T]:_(10)}]}}],[E]:[{[A]:342,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([16]),[P]:[{[N]:"u",[T]:_(14)},{[N]:"c",[T]:C},{[N]:"i",[T]:_(15)}],[I]:_([0,1,2])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "fragment/deferred-light",
  code: _(["use '",4,"'::{",5,",",6,",",7,"};use '",8,"'::{",9,",",10,"};use '",11,"'::{",12,"};@",13," fn ",0,"(u:",14,")->",10,";@",13," fn ",1,"(i:u32)->",9,";@",13," fn ",2,"(N:",D,",V:",D,",l:",9,",s:",10,",)->",D,";@",16," fn ",3,"(u:",14,",c:",C,",i:u32,)->",C,"{let s=",0,"(u.xy,c);let v=",5,"();let s1=s.position.xyz;let t=v.xyz-s1*v.w;let N:",D,"=normalize(s.normal.xyz);let V:",D,"=normalize(t);let l=",1,"(i);let o=",2,"(N,V,l,s);return ",C,"(o,1.0);}\n"]).join(''),
  hash: 0x76622b26836d8,
  table,
  shake: [[177,[0,3]],[227,[1,3]],[259,[2,3]],[342,[3]]],
  tree: decompressAST([[1,0,64],[1,65,119],[1,55,111],[1,57,106],[1,50,81],[1,32,114],[0,83,390],[1,0,7],[2,11,35],[2,74,84],[2,25,40],[2,134,142],[2,18,28]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0, "@use-gpu/wgsl/use/types": m1, "@use-gpu/wgsl/codec/octahedral": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getDeferredLightFragment = getSymbol("getDeferredLightFragment");
//# sourceMappingURL=deferred-light.wgsl.js.map
