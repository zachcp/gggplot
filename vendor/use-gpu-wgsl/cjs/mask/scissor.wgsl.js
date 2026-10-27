/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getScissorColor isScissored export bool return".split(' '));
const table = {[S]:_([0,1]),[W]:_([0,1]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([2]),[P]:[{[N]:"c",[T]:C},{[N]:"m",[T]:C}]}},{[A]:272,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(3),[Z]:_([2]),[P]:[{[N]:"m",[T]:C}]}}]};
const data = {
  name: "mask/scissor",
  code: _(["@",2," fn ",0,"(c:",C,",m:",C,")->",C,"{let m1=min(m.xy,m.zw);let m2=min(m1.x,m1.y);let d=dpdx(m2);let d1=dpdy(m2);let l=(length(d)+length(d1));let a=clamp(m2/l+0.5,0.0,1.0);if(HAS_ALPHA_TO_COVERAGE){",4," ",C,"(c.xyz,c.a*a);}else{",4," c*a;}}@",2," fn ",1,"(m:",C,")->",3,"{let m1=min(m.xy,m.zw);let m2=min(m1.x,m1.y);",4," m2<0.0;}\n"]).join(''),
  hash: 0x1bbda96b0d804e,
  table,
  shake: [[0,[0]],[272,[1]]],
  tree: decompressAST([[0,0,272],[1,0,7],[2,11,26],[0,261,362],[1,0,7],[2,11,22]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getScissorColor = getSymbol("getScissorColor");
exports.isScissored = getSymbol("isScissored");
//# sourceMappingURL=scissor.wgsl.js.map
