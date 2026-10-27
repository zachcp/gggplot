/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/view.wgsl");
const m1 = require("../../use/types.wgsl");
const m2 = require("../../codec/octahedral.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getAlbedo getNormals getMaterial getEmissive getDepth getGBufferSurface @use-gpu/wgsl/use/view getViewPosition clipToWorld to3D @use-gpu/wgsl/use/types SurfaceFragment @use-gpu/wgsl/codec/octahedral decodeOctahedral link vec2<f32> f32 export SurfaceFragment decodeOctahedral".split(' '));
const table = {[S]:_([0,1,2,3,4,5]),[W]:_([5]),[O]:[{[A]:0,[N]:_(6),[S]:_([7,8,9]),[K]:[{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)},{[N]:_(9),[J]:_(9)}]},{[A]:0,[N]:_(10),[S]:_([11]),[K]:[{[N]:_(11),[J]:_(11)}]},{[A]:0,[N]:_(12),[S]:_([13]),[K]:[{[N]:_(13),[J]:_(13)}]}],[X]:[{[A]:171,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([14]),[P]:[{[N]:"u",[T]:_(15)}]}},{[A]:214,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:C,[Z]:_([14]),[P]:[{[N]:"u",[T]:_(15)}]}},{[A]:258,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:C,[Z]:_([14]),[P]:[{[N]:"u",[T]:_(15)}]}},{[A]:303,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:C,[Z]:_([14]),[P]:[{[N]:"u",[T]:_(15)}]}},{[A]:348,[R]:_(4),[G]:2,[F]:{[N]:_(4),[T]:_(16),[Z]:_([14]),[P]:[{[N]:"u",[T]:_(15)}]}}],[E]:[{[A]:384,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(11),[Z]:_([17]),[P]:[{[N]:"u",[T]:_(15)},{[N]:"c",[T]:C}],[I]:_([0,1,2,4])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true}};
const data = {
  name: "surface/g-buffer-surface",
  code: _(["use '",6,"'::{",7,",",8,",",9,"};use '",10,"'::{",11,"};use '",12,"'::{",13,"};@",14," fn ",0,"(u:",15,")->",C,";@",14," fn ",1,"(u:",15,")->",C,";@",14," fn ",2,"(u:",15,")->",C,";@",14," fn ",3,"(u:",15,")->",C,";@",14," fn ",4,"(u:",15,")->f32;@",17," fn ",5,"(u:",15,",c:",C,",)->",11,"{let a=",0,"(u);let n=",1,"(u);let m=",2,"(u);let d=",4,"(u);let p=",9,"(",8,"(",C,"((u*2.0-1.0)*",15,"(1.0,-1.0),d,1.0)));let n1=",13,"(n.xy);let b=",13,"(n.zw);return ",11,"(",C,"(p,1.0),",C,"(n1,0.0),",C,"(b,a.w),",C,"(a.xyz,1.0),",C,"(0.0),m,0.0,);}\n"]).join(''),
  hash: 0x1f63bafaeb875f,
  table,
  shake: [[171,[0,5]],[214,[1,5]],[258,[2,5]],[303,[3]],[348,[4,5]],[384,[5]]],
  tree: decompressAST([[1,0,64],[1,65,113],[1,49,105],[1,57,99],[1,43,86],[1,44,88],[1,45,89],[1,45,80],[0,36,439],[1,0,7],[2,11,28],[2,45,60],[2,22,31],[2,19,29],[2,20,31],[2,21,29],[2,18,22],[2,5,16],[2,70,86],[2,29,45],[2,30,45]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0, "@use-gpu/wgsl/use/types": m1, "@use-gpu/wgsl/codec/octahedral": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getGBufferSurface = getSymbol("getGBufferSurface");
//# sourceMappingURL=g-buffer-surface.wgsl.js.map
