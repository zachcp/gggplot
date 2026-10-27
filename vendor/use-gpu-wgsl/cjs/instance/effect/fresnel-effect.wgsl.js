/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/types.wgsl");
const m1 = require("../../use/view.wgsl");
const m2 = require("../../fragment/pbr.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSurface getOpacity getFresnelEffectSurface @use-gpu/wgsl/use/types SurfaceFragment @use-gpu/wgsl/use/view getViewPosition @use-gpu/wgsl/fragment/pbr fresnelSchlick link f32 optional export SurfaceFragment".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]},{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]},{[A]:0,[N]:_(7),[S]:_([8]),[K]:[{[N]:_(8),[J]:_(8)}]}],[X]:[{[A]:148,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(4),[Z]:_([9]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}]}},{[A]:274,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(10),[Z]:_([11,9])}}],[E]:[{[A]:324,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(4),[Z]:_([12]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "effect/fresnel-effect",
  code: _(["use '",3,"'::{",4,"};use '",5,"'::{",6,"};use '",7,"'::{",8,"};@",9," fn ",0,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->",4,"{};@",11," @",9," fn ",1,"()->f32{return 0.0;};@",12," fn ",2,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->",4,"{var s1=",0,"(c,u,s,n,t,p,c1);let v=",6,"();let s2=s1.position.xyz;let t1=v.xyz-s2*v.w;let N:",D,"=normalize(s1.normal.xyz);let V:",D,"=normalize(t1);let o=",1,"();let c2=clamp(dot(N,V),0.0,1.0);let f=",8,"(c2,o,1.0);s1.albedo.a=s1.albedo.a*f;return s1;}\n"]).join(''),
  hash: 0x144e0e152ed493,
  table,
  shake: [[148,[0,2]],[274,[1,2]],[324,[2]]],
  tree: decompressAST([[1,0,48],[1,49,96],[1,48,98],[1,51,176],[4,126,175,1],[1,0,9],[1,10,15],[2,9,19],[0,31,460],[1,0,7],[2,11,34],[2,112,127],[2,23,33],[2,33,48],[2,138,148],[2,50,64]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0, "@use-gpu/wgsl/use/view": m1, "@use-gpu/wgsl/fragment/pbr": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getFresnelEffectSurface = getSymbol("getFresnelEffectSurface");
//# sourceMappingURL=fresnel-effect.wgsl.js.map
