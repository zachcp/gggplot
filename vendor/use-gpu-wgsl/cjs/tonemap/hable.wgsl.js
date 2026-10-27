/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getWhitePoint tonemapHable hable hable3 f32 optional link export return".split(' '));
const table = {[S]:_([0,"A","B","C","D","E","F",1,2,3]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(4),[Z]:_([5,6])}}],[E]:[{[A]:130,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([7]),[P]:[{[N]:"c",[T]:C}],[I]:_([0,3,2])}}],[L]:{[_(0)]:true}};
const data = {
  name: "tonemap/hable",
  code: _(["@",5," @",6," fn ",0,"()->f32{",8," 4.0;}const A=0.15;const B=0.50;const C=0.10;const D=0.20;const E=0.02;const F=0.30;@",7," fn ",1,"(c:",C,")->",C,"{let w=",0,"();let r=c.rgb;",8," ",C,"(",2,"3(r*2.0)/",2,"(w),c.a);};fn ",2,"(x:f32)->f32{",8,"((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;};fn ",2,"3(x:",D,")->",D,"{",8,"((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;};\n"]).join(''),
  hash: 0x9a6be26e22919,
  table,
  shake: [[0,[0,7]],[52,[1,8,7,9]],[65,[2,8,7,9]],[78,[3,8,7,9]],[91,[4,8,7,9]],[104,[5,8,7,9]],[117,[6,8,7,9]],[130,[7]],[259,[8,7]],[328,[9,7]]],
  tree: decompressAST([[4,0,52,0],[1,0,9],[1,10,15],[2,9,22],[0,33,46],[2,6,7],[0,7,20],[2,6,7],[0,7,20],[2,6,7],[0,7,20],[2,6,7],[0,7,20],[2,6,7],[0,7,20],[2,6,7],[0,7,135],[1,0,7],[2,11,23],[2,43,56],[2,45,51],[2,14,19],[0,16,84],[2,3,8],[2,29,30],[2,4,5],[2,2,3],[2,3,4],[2,2,3],[2,7,8],[2,4,5],[2,3,4],[2,2,3],[2,4,5],[2,2,3],[0,4,85],[2,3,9],[2,42,43],[2,4,5],[2,2,3],[2,3,4],[2,2,3],[2,7,8],[2,4,5],[2,3,4],[2,2,3],[2,4,5],[2,2,3]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.tonemapHable = getSymbol("tonemapHable");
//# sourceMappingURL=hable.wgsl.js.map
