/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../fragment/pbr.wgsl");
const m1 = require("../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("sampleEnvironment sqr varianceForRoughness applyPBREnvironment @use-gpu/wgsl/fragment/pbr IBL IBLResult environmentBRDF @use-gpu/wgsl/use/types SurfaceFragment link f32 export sampleEnvironment return".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5,6,7]),[K]:[{[N]:_(5),[J]:_(5)},{[N]:_(6),[J]:_(6)},{[N]:_(7),[J]:_(7)}]},{[A]:0,[N]:_(8),[S]:_([9]),[K]:[{[N]:_(9),[J]:_(9)}]}],[X]:[{[A]:115,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([10]),[P]:[{[N]:"u",[T]:D},{[N]:"s",[T]:_(11)},{[N]:"d",[T]:D},{[N]:"d1",[T]:D}]}}],[E]:[{[A]:354,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:D,[Z]:_([12]),[P]:[{[N]:"N",[T]:D},{[N]:"V",[T]:D},{[N]:"s",[T]:_(9)}],[I]:_([2,0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "material/pbr-environment",
  code: _(["use '",4,"'::{IBL,",6,",",7,"};use '",8,"'::{",9,"};@",10," fn ",0,"(u:",D,",s:f32,d:",D,",d1:",D,")->",C,";fn sqr(x:f32)->f32{",14," x*x;}fn ",2,"(r:f32)->f32{if(r<0.4){",14," 1.74*sqr(sqr(r));}if(r<0.8){",14," 0.575*r-0.184;}",14," 0.312*r+0.027;};@",12," fn ",3,"(N:",D,",V:",D,",s:",9,",)->",D,"{let a=s.albedo;let m=s.material.x;let r=s.material.y;let s1=sqrt(",2,"(r));let i=IBL(N,V,a.xyz,m,r);let R=reflect(-V,N);let F=i.diffuse;let F1=i.specular;let d=i.dotNV;let d1=dpdx(R);let d2=dpdy(R);let b=s.occlusion.xyz;let o=s.occlusion.w;let b1=",7,"(r,d);let d3=F*",0,"(b,-1.0,d1,d2).xyz;let s2=max(",D,"(0.0),b1.x+F1*b1.y)*",0,"(R,s1,d1,d2).xyz;",14,"(d3+s2)*o;}\n"]).join(''),
  hash: 0x1df1636f61ca74,
  table,
  shake: [[115,[0,3]],[197,[1,2,3]],[228,[2,3]],[354,[3]]],
  tree: decompressAST([[1,0,65],[1,66,114],[1,49,130],[0,82,113],[2,3,6],[0,28,153],[2,3,23],[2,55,58],[2,4,7],[0,64,569],[1,0,7],[2,11,30],[2,46,61],[2,94,114],[2,31,34],[2,166,181],[2,30,47],[2,76,93]], table[S]),
};

const libs = {"@use-gpu/wgsl/fragment/pbr": m0, "@use-gpu/wgsl/use/types": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.applyPBREnvironment = getSymbol("applyPBREnvironment");
//# sourceMappingURL=pbr-environment.wgsl.js.map
