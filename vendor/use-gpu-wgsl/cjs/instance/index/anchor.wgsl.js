/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getAnchor getAnchorIndex vec4<u32> link u32 vec2<u32> export".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3]),[P]:[{[N]:"i",[T]:_(4)}]}}],[E]:[{[A]:37,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"v",[T]:_(4)},{[N]:"i",[T]:_(4)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "index/anchor",
  code: _(["@",3," fn ",0,"(i:u32)->",2,";@",6," fn ",0,"Index(v:u32,i:u32)->",5,"{return ",5,"(i,",0,"(i).x);};\n"]).join(''),
  hash: 0x139d3b2d67ecb2,
  table,
  shake: [[0,[0,1]],[37,[1]]],
  tree: decompressAST([[1,0,36],[0,37,123],[1,0,7],[2,11,25],[2,58,67]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getAnchorIndex = getSymbol("getAnchorIndex");
//# sourceMappingURL=anchor.wgsl.js.map
