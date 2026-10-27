/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTransformMatrix getTransformBase getCartesian4DPosition mat4x4<f32> optional link u32 export".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(3),[Z]:_([4,5]),[P]:[{[N]:"i",[T]:_(6)}]}},{[A]:60,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([4,5]),[P]:[{[N]:"i",[T]:_(6)}]}}],[E]:[{[A]:116,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([7]),[P]:[{[N]:"v",[T]:C}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "transform/cartesian-4d",
  code: _(["@",4," @",5," fn ",0,"(i:u32)->",3,"{};@",4," @",5," fn ",1,"(i:u32)->",C,"{};@",7," fn ",2,"(v:",C,")->",C,"{return ",0,"(0)*v+",1,"(0);}\n"]).join(''),
  hash: 0x18419dcfc51976,
  table,
  shake: [[0,[0,2]],[60,[1,2]],[116,[2]]],
  tree: decompressAST([[4,0,59,0],[1,0,9],[1,10,15],[2,9,27],[4,41,96,1],[1,0,9],[1,10,15],[2,9,25],[0,37,147],[1,0,7],[2,11,33],[2,54,72],[2,24,40]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getCartesian4DPosition = getSymbol("getCartesian4DPosition");
//# sourceMappingURL=cartesian-4d.wgsl.js.map
