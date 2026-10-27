/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("shadowTexture shadowSampler sampleShadow f32 export vec2<f32> u32 texture_depth_2d_array group(PASS) binding(2) sampler_comparison binding(3)".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[E]:[{[A]:124,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(3),[Z]:_([4]),[P]:[{[N]:"u",[T]:_(5)},{[N]:"i",[T]:_(6)},{[N]:"l",[T]:_(3)}],[I]:_([0,1])}}],[B]:[{[A]:0,[R]:_(0),[G]:32,[V]:{[N]:_(0),[T]:_(7),[Z]:_([8,9])}},{[A]:64,[R]:_(1),[G]:32,[V]:{[N]:_(1),[T]:_(10),[Z]:_([8,11])}}]};
const data = {
  name: "use/shadow",
  code: _(["@",8,"@",9,"var ",0,":",7,";@",8,"@",11,"var ",1,":",10,";@",4," fn ",2,"(u:",5,",i:u32,l:f32)->f32{return textureSampleCompareLevel(",0,",",1,",u,i,l);}\n"]).join(''),
  hash: 0x1c2140d4f38950,
  table,
  shake: [[0,[0,2]],[64,[1,2]],[124,[2]]],
  tree: decompressAST([[0,0,64],[3,0,12],[3,12,23],[2,15,28],[0,37,97],[3,0,12],[3,12,23],[2,15,28],[0,33,156],[1,0,7],[2,11,23],[2,76,89],[2,14,27]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.sampleShadow = getSymbol("sampleShadow");
//# sourceMappingURL=shadow.wgsl.js.map
