/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/view.wgsl");
const m1 = require("../../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSurface applyEnvironment getDeferredEnvironmentFragment @use-gpu/wgsl/use/view getViewPosition @use-gpu/wgsl/use/types Light SurfaceFragment link vec2<f32> export u32 SurfaceFragment".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]},{[A]:0,[N]:_(5),[S]:_([6,7]),[K]:[{[N]:_(6),[J]:_(6)},{[N]:_(7),[J]:_(7)}]}],[X]:[{[A]:103,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(7),[Z]:_([8]),[P]:[{[N]:"u",[T]:_(9)}]}},{[A]:153,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:D,[Z]:_([8]),[P]:[{[N]:"N",[T]:D},{[N]:"V",[T]:D},{[N]:"s",[T]:_(7)}]}}],[E]:[{[A]:257,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([10]),[P]:[{[N]:"u",[T]:_(9)},{[N]:"c",[T]:C},{[N]:"i",[T]:_(11)}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "fragment/deferred-environment",
  code: _(["use '",3,"'::{",4,"};use '",5,"'::{",6,",",7,"};@",8," fn ",0,"(u:",9,")->",7,";@",8," fn ",1,"(N:",D,",V:",D,",s:",7,",)->",D,"{return ",D,"(0.0);}@",10," fn ",2,"(u:",9,",c:",C,",i:u32,)->",C,"{let s=",0,"(u.xy,c);let v=",4,"();let s1=s.position.xyz;let t=v.xyz-s1*v.w;let N:",D,"=normalize(s.normal.xyz);let V:",D,"=normalize(t);let o=",1,"(N,V,s);return ",C,"(o,1.0);}\n"]).join(''),
  hash: 0xf1ce5ffdc5f4f,
  table,
  shake: [[103,[0,2]],[153,[1,2]],[257,[2]]],
  tree: decompressAST([[1,0,47],[1,48,102],[1,55,104],[1,50,154],[0,104,403],[1,0,7],[2,11,41],[2,80,90],[2,25,40],[2,134,150]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0, "@use-gpu/wgsl/use/types": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getDeferredEnvironmentFragment = getSymbol("getDeferredEnvironmentFragment");
//# sourceMappingURL=deferred-environment.wgsl.js.map
