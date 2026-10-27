/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../mask/scissor.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("main @use-gpu/wgsl/mask/scissor isScissored vec4<u32> location(0) fragment fragScissor fragUV vec2<f32> location(1) fragId u32 location(2) interpolate(flat) fragIndex location(3) location fragId".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[O]:[{[A]:0,[N]:_(1),[S]:_([2]),[K]:[{[N]:_(2),[J]:_(2)}]}],[E]:[{[A]:48,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:{[N]:_(3),[Z]:_([4])},[Z]:_([5]),[P]:[{[N]:_(6),[T]:C,[Z]:_([4])},{[N]:_(7),[T]:_(8),[Z]:_([9])},{[N]:_(10),[T]:_(11),[Z]:_([12,13])},{[N]:_(14),[T]:_(11),[Z]:_([15,13])}]}}]};
const data = {
  name: "fragment/pick",
  code: _(["use '",1,"'::{",2,"};@",5," fn ",0,"(@",4,6,":",C,",@",9,7,":",8,",@",12,"@",13,10,":u32,@",15,"@",13,14,":u32,)->@",4,3,"{if(",2,"(",6,")){discard;}if(UV_PICKING){let x=vec2<u32>(clamp(",7,"*65535.0,",8,"(0.0),",8,"(65535.0)));let i=x.x|(x.y<<16);return ",3,"(",10,",i,0u,0u);}else{return ",3,"(",10,",",14,",0u,0u);}}\n"]).join(''),
  hash: 0x34c910225d3d9,
  table,
  shake: [[48,[0]]],
  tree: decompressAST([[1,0,47],[0,48,467],[3,0,9],[2,13,17],[3,5,17],[3,34,46],[3,29,41],[3,12,30],[3,29,41],[3,12,30],[3,35,47],[2,25,36]], table[S]),
};

const libs = {"@use-gpu/wgsl/mask/scissor": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=pick.wgsl.js.map
