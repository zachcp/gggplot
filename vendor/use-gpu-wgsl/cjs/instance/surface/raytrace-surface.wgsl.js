/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSurface traceSurface getRaytraceSurface @use-gpu/wgsl/use/types RTFragment infer(T) link export infers".split(' '));
const table = {[S]:_(["T",0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[X]:[{[A]:58,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([5])},[Z]:_([6]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:177,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(4),[Z]:_([6]),[P]:[{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c",[T]:C}]}}],[E]:[{[A]:285,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:"T",[Z]:_([7]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_(["T",0,1])}}],[_(8)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "surface/raytrace-surface",
  code: _(["use '",3,"'::{",4,"};@infer ",T," T;@",6," fn ",0,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->@",5,"T;@",6," fn ",1,"(u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c:",C,",)->",4,";@",7," fn getRay",1,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->T{var s1=",0,"(c,u,s,n,t,p,c1);let f=",1,"(u,s,n,t,p,c1);s1.position=f.position;s1.normal=f.normal;s1.depth=f.depth;s1.albedo.a*=f.alpha;return s1;}\n"]).join(''),
  hash: 0xc3be9ff9639f9,
  table,
  shake: [[44,[0,1,3]],[58,[1,3]],[177,[2,3]],[285,[3]]],
  tree: decompressAST([[1,0,43],[1,44,58],[1,14,132],[1,119,226],[0,108,386],[1,0,7],[2,11,29],[2,107,108],[2,9,19],[2,33,45]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getRaytraceSurface = getSymbol("getRaytraceSurface");
//# sourceMappingURL=raytrace-surface.wgsl.js.map
