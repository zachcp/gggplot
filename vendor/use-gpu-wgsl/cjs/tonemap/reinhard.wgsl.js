/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getWhitePoint luminance tonemapReinhard f32 optional link export return".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(3),[Z]:_([4,5])}}],[E]:[{[A]:131,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([6]),[P]:[{[N]:"c",[T]:C}],[I]:_([0,1])}}],[L]:{[_(0)]:true}};
const data = {
  name: "tonemap/reinhard",
  code: _(["@",4," @",5," fn ",0,"()->f32{",7," 4.0;}fn ",1,"(r:",D,")->f32{",7," dot(r,",D,"(0.2126,0.7152,0.0722));};@",6," fn ",2,"(c:",C,")->",C,"{let w=",0,"();let r=c.rgb;let l=",1,"(r);let n=l*(1.0+(l/(w*w)));let l1=n/(1.0+l);",7," ",C,"(r*l1/l,c.a);};\n"]).join(''),
  hash: 0x182d88f4341676,
  table,
  shake: [[0,[0,2]],[52,[1,2]],[131,[2]]],
  tree: decompressAST([[4,0,52,0],[1,0,9],[1,10,15],[2,9,22],[0,33,111],[2,3,12],[0,76,251],[1,0,7],[2,11,26],[2,46,59],[2,34,43]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.tonemapReinhard = getSymbol("tonemapReinhard");
//# sourceMappingURL=reinhard.wgsl.js.map
