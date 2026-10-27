/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("COLORS pmremGridOverlay export vec2<f32> f32".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[E]:[{[A]:113,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([2]),[P]:[{[N]:"x",[T]:_(3)},{[N]:"s",[T]:_(3)},{[N]:"s1",[T]:_(4)}],[I]:_([0])}}]};
const data = {
  name: "pmrem/pmrem-debug",
  code: _(["const ",0,"=array(",D,"(0.8,0.2,0.2),",D,"(0.8,0.6,0.0),",D,"(0.0,0.7,0.1),",D,"(0.2,0.4,1.0),);@",2," fn ",1,"(x:",3,",s:",3,",s1:f32)->",C,"{let f=floor(x-.5)+.5;let _1=f*2.0-s;let a=abs(_1);let d=abs(s.x-a.x-a.y);let u=x-f;let o=min(u,1.0-u);let d1=min(o.x,o.y);let s2=-(d1/s1)/s.x;let a1=clamp(s2+.5,0.0,1.0);let s3=select(vec2<u32>(0u),vec2<u32>(1u),_1>",3,"(0.0));let r=",0,"[s3.x+(s3.y<<1u)];return ",C,"(r*a1,a1);};\n"]).join(''),
  hash: 0xdd32b4ba8e9d6,
  table,
  shake: [[0,[0,1]],[113,[1]]],
  tree: decompressAST([[0,0,113],[2,6,12],[0,107,466],[1,0,7],[2,11,27],[2,297,303]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.pmremGridOverlay = getSymbol("pmremGridOverlay");
//# sourceMappingURL=pmrem-debug.wgsl.js.map
