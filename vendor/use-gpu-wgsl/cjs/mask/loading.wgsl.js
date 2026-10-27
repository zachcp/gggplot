/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../mask/sdf.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getAngle getLoadingSpinnerMask @use-gpu/wgsl/mask/sdf getUVScale scaleSDF f32 optional link export vec2<f32>".split(' '));
const table = {[S]:_(["PI",0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3,4]),[K]:[{[N]:_(3),[J]:_(3)},{[N]:_(4),[J]:_(4)}]}],[X]:[{[A]:74,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6,7])}}],[E]:[{[A]:121,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(5),[Z]:_([8]),[P]:[{[N]:"u",[T]:_(9)}],[I]:_(["PI",0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "mask/loading",
  code: _(["use '",2,"'::{",3,",",4,"};const PI=3.1415926536;@",6," @",7," fn ",0,"()->f32{return 0.0;}@",8," fn ",1,"(u:",9,")->f32{let s=",3,"(u);let x=u*2.0-1.0;let r=length(x);let t=-atan2(x.y,x.x);let s1=min(1.0-r,r-0.8);let a=",4,"(s1,s);let f=fract((t/PI/2.0)-",0,"());let a1=max(0.0,f*1.5-.5);return a*a1;};\n"]).join(''),
  hash: 0xfb9ce34dac00,
  table,
  shake: [[52,[0,2]],[74,[1,2]],[121,[2]]],
  tree: decompressAST([[1,0,51],[0,52,74],[2,6,8],[4,16,63,1],[1,0,9],[1,10,15],[2,9,17],[0,28,271],[1,0,7],[2,11,32],[2,46,56],[2,98,106],[2,30,32],[2,8,16]], table[S]),
};

const libs = {"@use-gpu/wgsl/mask/sdf": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getLoadingSpinnerMask = getSymbol("getLoadingSpinnerMask");
//# sourceMappingURL=loading.wgsl.js.map
