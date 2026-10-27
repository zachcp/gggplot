/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getAxisStep getAxisOrigin getAxisPosition link export u32".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([3])}},{[A]:34,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:C,[Z]:_([3])}}],[E]:[{[A]:70,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([4]),[P]:[{[N]:"i",[T]:_(5)}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "plot/axis",
  code: _(["@",3," fn ",0,"()->",C,";@",3," fn ",1,"()->",C,";@",4," fn ",2,"(i:u32)->",C,"{return ",0,"()*f32(i)+",1,"();}\n"]).join(''),
  hash: 0x170f8e5c942896,
  table,
  shake: [[0,[0,2]],[34,[1,2]],[70,[2]]],
  tree: decompressAST([[1,0,33],[1,34,69],[0,36,126],[1,0,7],[2,11,26],[2,41,52],[2,21,34]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getAxisPosition = getSymbol("getAxisPosition");
//# sourceMappingURL=axis.wgsl.js.map
