/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getInstanceIndex getInstanceLookupIndex u32 link vec2<u32> export".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3]),[P]:[{[N]:"i",[T]:_(2)}]}}],[E]:[{[A]:40,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"v",[T]:_(2)},{[N]:"i",[T]:_(2)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "index/lookup",
  code: _(["@",3," fn ",0,"(i:u32)->u32{};@",5," fn ",1,"(v:u32,i:u32)->",4,"{var e:u32;var u:u32;e=i;u=",0,"(i);return ",4,"(e,u);};\n"]).join(''),
  hash: 0x1125a69b34c9c3,
  table,
  shake: [[0,[0,1]],[40,[1]]],
  tree: decompressAST([[1,0,39],[0,40,167],[1,0,7],[2,11,33],[2,73,89]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getInstanceLookupIndex = getSymbol("getInstanceLookupIndex");
//# sourceMappingURL=lookup.wgsl.js.map
