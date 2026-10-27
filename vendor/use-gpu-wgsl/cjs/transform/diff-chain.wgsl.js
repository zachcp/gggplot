/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("transformPositionA getDifferentialA getDifferentialB getChainDifferential link bool export".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([4]),[P]:[{[N]:"o",[T]:C}]}},{[A]:52,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:C,[Z]:_([4]),[P]:[{[N]:"v",[T]:C},{[N]:"o",[T]:C},{[N]:"c",[T]:_(5)}]}},{[A]:121,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:C,[Z]:_([4]),[P]:[{[N]:"v",[T]:C},{[N]:"o",[T]:C},{[N]:"c",[T]:_(5)}]}}],[E]:[{[A]:190,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([6]),[P]:[{[N]:"v",[T]:C},{[N]:"o",[T]:C},{[N]:"c",[T]:_(5)}],[I]:_([1,2,0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "transform/diff-chain",
  code: _(["@",4," fn ",0,"(o:",C,")->",C,";@",4," fn ",1,"(v:",C,",o:",C,",c:",5,")->",C,";@",4," fn ",2,"(v:",C,",o:",C,",c:",5,")->",C,";@",6," fn ",3,"(v:",C,",o:",C,",c:",5,")->",C,"{let v1=",1,"(v,o,c);return ",2,"(v1,",0,"(o),c);}\n"]).join(''),
  hash: 0x1a12fee99947e9,
  table,
  shake: [[0,[0,3]],[52,[1,3]],[121,[2,3]],[190,[3]]],
  tree: decompressAST([[1,0,51],[1,52,120],[1,69,137],[0,69,228],[1,0,7],[2,11,31],[2,71,87],[2,31,47],[2,20,38]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getChainDifferential = getSymbol("getChainDifferential");
//# sourceMappingURL=diff-chain.wgsl.js.map
