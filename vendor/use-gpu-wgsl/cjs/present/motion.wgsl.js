/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getEffect getDirection getValue getLayout getSlideMotion u32 optional link f32 export optional return getDirection".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([4]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6,7])}},{[A]:47,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([6,7])}},{[A]:116,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(8),[Z]:_([6,7])}},{[A]:162,[R]:_(3),[G]:6,[F]:{[N]:_(3),[T]:C,[Z]:_([6,7])}}],[E]:[{[A]:228,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:C,[Z]:_([9]),[P]:[{[N]:"p",[T]:C}],[I]:_([0,1,2,3])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "present/motion",
  code: _(["@",6," @",7," fn ",0,"()->u32{",11," 0;};@",6," @",7," fn ",1,"()->",C,"{",11," ",C,"(0.0);};@",6," @",7," fn ",2,"()->f32{",11," 0;};@",6," @",7," fn ",3,"()->",C,"{",11," ",C,"(0.0);};@",9," fn ",4,"(p:",C,")->",C,"{let e=",0,"();let d=",1,"();let v=",2,"();let l=",3,"();var p1=p;if(e==3){let d1=",1,"();let d2=",C,"(l.zw-l.xy,1.0,0.0)*d1;p1+=d2*p1.w*v;}",11," p1;}\n"]).join(''),
  hash: 0x12e27cd9435a40,
  table,
  shake: [[0,[0,4]],[47,[1,4]],[116,[2,4]],[162,[3,4]],[228,[4]]],
  tree: decompressAST([[4,0,46,0],[1,0,9],[1,10,15],[2,9,18],[4,28,96,1],[1,0,9],[1,10,15],[2,9,21],[4,50,95,2],[1,0,9],[1,10,15],[2,9,17],[4,27,92,3],[1,0,9],[1,10,15],[2,9,18],[0,47,276],[1,0,7],[2,11,25],[2,45,54],[2,18,30],[2,21,29],[2,17,26],[2,37,49]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getSlideMotion = getSymbol("getSlideMotion");
//# sourceMappingURL=motion.wgsl.js.map
