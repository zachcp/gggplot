/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("ssaoTexture sampleSSAO export vec2<u32> texture_2d<f32> group(PASS) binding(4)".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[E]:[{[A]:55,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([2]),[P]:[{[N]:"x",[T]:_(3)}],[I]:_([0])}}],[B]:[{[A]:0,[R]:_(0),[G]:32,[V]:{[N]:_(0),[T]:_(4),[Z]:_([5,6])}}]};
const data = {
  name: "use/ssao",
  code: _(["@",5,"@",6,"var ",0,":",4,";@",2," fn ",1,"(x:",3,")->",C,"{return textureLoad(",0,",x,0u);}\n"]).join(''),
  hash: 0xe401d77754f8e,
  table,
  shake: [[0,[0,1]],[55,[1]]],
  tree: decompressAST([[0,0,55],[3,0,12],[3,12,23],[2,15,26],[0,28,112],[1,0,7],[2,11,21],[2,54,65]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.sampleSSAO = getSymbol("sampleSSAO");
//# sourceMappingURL=ssao.wgsl.js.map
