/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getInstancedFaceIndex vec2<u32> export u32".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(1),[Z]:_([2]),[P]:[{[N]:"v",[T]:_(3)},{[N]:"i",[T]:_(3)}]}}]};
const data = {
  name: "index/face",
  code: _(["@",2," fn ",0,"(v:u32,i:u32)->",1,"{return ",1,"(i,i*3u+v);};\n"]).join(''),
  hash: 0x1824f7523c1a8a,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,85],[1,0,7],[2,11,32]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getInstancedFaceIndex = getSymbol("getInstancedFaceIndex");
//# sourceMappingURL=face.wgsl.js.map
