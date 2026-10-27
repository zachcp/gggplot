/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSurface getNormalMap getNormalMapSurface @use-gpu/wgsl/use/types SurfaceFragment link optional vec2<f32> export SurfaceFragment".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[X]:[{[A]:49,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}]}},{[A]:175,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([6,5]),[P]:[{[N]:"u",[T]:_(7)}]}}],[E]:[{[A]:267,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(4),[Z]:_([8]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_([1,0])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "surface/normal-map-surface",
  code: _(["use '",3,"'::{",4,"};@",5," fn ",0,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->",4,"{};@",6," @",5," fn ",1,"(u:",7,")->",C,"{return ",C,"(0.0,0.0,1.0,0.0);};@",8," fn ",1,"Surface(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->",4,"{let t1=",1,"(u.xy)*2.0-1.0;let b=cross(n.xyz,t.xyz)*t.w;let b1=normalize(t1.x*t.xyz+t1.y*b+t1.z*n.xyz);return ",0,"(c,u,s,",C,"(b1,1.0),t,p,c1);}\n"]).join(''),
  hash: 0xdf10056794e45,
  table,
  shake: [[49,[0,2]],[175,[1,2]],[267,[2]]],
  tree: decompressAST([[1,0,48],[1,49,174],[4,126,217,1],[1,0,9],[1,10,15],[2,9,21],[0,73,369],[1,0,7],[2,11,30],[2,108,123],[2,23,35],[2,110,120]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getNormalMapSurface = getSymbol("getNormalMapSurface");
//# sourceMappingURL=normal-map-surface.wgsl.js.map
