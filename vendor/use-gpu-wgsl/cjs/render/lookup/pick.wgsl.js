/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getID getIndex getPickingID u32 optional link vec2<u32> export return".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(3),[Z]:_([4,5]),[P]:[{[N]:"i",[T]:_(3)}]}},{[A]:49,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(3),[Z]:_([4,5]),[P]:[{[N]:"i",[T]:_(3)}]}}],[E]:[{[A]:100,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(6),[Z]:_([7]),[P]:[{[N]:"i",[T]:_(3)}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "lookup/pick",
  code: _(["@",4," @",5," fn ",0,"(i:u32)->u32{",8," 0u;};@",4," @",5," fn ",1,"(i:u32)->u32{",8," i;};@",7," fn ",2,"(i:u32)->",6,"{",8," ",6,"(",0,"(i),",1,"(i));}\n"]).join(''),
  hash: 0x6e0fddb13b0a5,
  table,
  shake: [[0,[0,2]],[49,[1,2]],[100,[2]]],
  tree: decompressAST([[4,0,48,0],[1,0,9],[1,10,15],[2,9,14],[4,30,80,1],[1,0,9],[1,10,15],[2,9,17],[0,32,114],[1,0,7],[2,11,23],[2,48,53],[2,9,17]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getPickingID = getSymbol("getPickingID");
//# sourceMappingURL=pick.wgsl.js.map
