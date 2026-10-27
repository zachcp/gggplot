/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("remap getNormalFragment @use-gpu/wgsl/use/types SurfaceFragment optional link export".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3]),[K]:[{[N]:_(3),[J]:_(3)}]}],[X]:[{[A]:49,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:D,[Z]:_([4,5]),[P]:[{[N]:"n",[T]:D}]}}],[E]:[{[A]:108,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([6]),[P]:[{[N]:"s",[T]:_(3)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "fragment/normal",
  code: _(["use '",2,"'::{",3,"};@",4," @",5," fn ",0,"(n:",D,")->",D,"{return n;}@",6," fn ",1,"(s:",3,",)->",C,"{let N:",D,"=normalize(s.normal.xyz);let n=",0,"(N);let a=s.albedo.a;return ",C,"(n,a);}\n"]).join(''),
  hash: 0x7b27296607fc0,
  table,
  shake: [[49,[0,1]],[108,[1]]],
  tree: decompressAST([[1,0,48],[4,49,108,0],[1,0,9],[1,10,15],[2,9,14],[0,40,195],[1,0,7],[2,11,28],[2,20,35],[2,75,80]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getNormalFragment = getSymbol("getNormalFragment");
//# sourceMappingURL=normal.wgsl.js.map
