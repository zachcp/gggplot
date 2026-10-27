/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("IndirectDrawMetaAtomic IndirectDrawMeta export vertexCount u32 instanceCount atomic<u32> firstVertex firstInstance dispatchCount _unused1 _unused2 generationIndex nextVertexIndex atomic".split(' '));
const table = {[Y]:_([0,1]),[S]:_([0,1]),[W]:_([0,1]),[E]:[{[A]:0,[R]:_(0),[G]:1,[U]:{[N]:_(0),[Z]:_([2]),[M]:[{[N]:_(3),[T]:_(4)},{[N]:_(5),[T]:_(6)},{[N]:_(7),[T]:_(4)},{[N]:_(8),[T]:_(4)},{[N]:_(9),[T]:_(6)},{[N]:_(10),[T]:_(4)},{[N]:_(11),[T]:_(4)},{[N]:_(12),[T]:_(4)},{[N]:_(13),[T]:_(6)}]}},{[A]:216,[R]:_(1),[G]:1,[U]:{[N]:_(1),[Z]:_([2]),[M]:[{[N]:_(3),[T]:_(4)},{[N]:_(5),[T]:_(4)},{[N]:_(7),[T]:_(4)},{[N]:_(8),[T]:_(4)},{[N]:_(9),[T]:_(4)},{[N]:_(10),[T]:_(4)},{[N]:_(11),[T]:_(4)},{[N]:_(12),[T]:_(4)},{[N]:_(13),[T]:_(4)}]}}]};
const data = {
  name: "contour/types",
  code: _(["@",2," ",U," ",0,"{",3,":u32,",5,":",6,",",7,":u32,",8,":u32,",9,":",6,",",10,":u32,",11,":u32,",12,":u32,",13,":",6,",};@",2," ",U," ",1,"{",3,":u32,",5,":u32,",7,":u32,",8,":u32,",9,":u32,",10,":u32,",11,":u32,",12,":u32,",13,":u32,};\n"]).join(''),
  hash: 0x7c1dea4309b8c,
  table,
  shake: [[0,[0]],[216,[1]]],
  tree: decompressAST([[0,0,215],[1,0,7],[2,15,37],[0,201,386],[1,0,7],[2,15,31]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.IndirectDrawMetaAtomic = getSymbol("IndirectDrawMetaAtomic");
exports.IndirectDrawMeta = getSymbol("IndirectDrawMeta");
//# sourceMappingURL=types.wgsl.js.map
