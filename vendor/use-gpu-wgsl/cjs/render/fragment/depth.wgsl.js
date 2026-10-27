/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../fragment/bayer.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getFragment getScissor main @use-gpu/wgsl/fragment/bayer bayer4x4f infer(T) link optional void fragment fragCoord builtin(position) fragAlpha f32 location(0) fragUV location(1) fragST location(2) fragScissor location(3) infers location".split(' '));
const table = {[S]:_(["T",0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[X]:[{[A]:62,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([5])},[Z]:_([6]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:135,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([7,6]),[P]:[{[N]:"c",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:211,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(8),[Z]:_([9]),[P]:[{[N]:_(10),[T]:C,[Z]:_([11])},{[N]:_(12),[T]:_(13),[Z]:_([14])},{[N]:_(15),[T]:C,[Z]:_([16])},{[N]:_(17),[T]:C,[Z]:_([18])},{[N]:_(19),[T]:C,[Z]:_([20])}],[I]:_([0,1])}}],[_(21)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "fragment/depth",
  code: _(["use '",3,"'::{",4,"};@infer ",T," T;@",6," fn ",0,"(c:",C,",u:",C,",s:",C,",)->@",5,"T{};@",7," @",6," fn ",1,"(c:",C,",s:",C,")->",C,"{return c;}@",9," fn ",2,"(@",11,10,":",C,",@",14,12,":f32,@",16,15,":",C,",@",18,17,":",C,",@",20,19,":",C,",){var o=",C,"(1.0,1.0,1.0,",12,");o=",0,"(o,",15,",",17,");if(HAS_SCISSOR){o=",1,"(o,",19,");}if(HAS_ALPHA_TO_DISCARD){if(o.a<=0.0){discard;}}if(o.a<1.0){let x=vec2<u32>(",10,".xy);if(o.a<",4,"(x)){discard;}}}\n"]).join(''),
  hash: 0x17f34b0cd84c32,
  table,
  shake: [[48,[0,1,3]],[62,[1,3]],[135,[2,3]],[211,[3]]],
  tree: decompressAST([[1,0,47],[1,48,62],[1,14,86],[4,73,149,2],[1,0,9],[1,10,15],[2,9,19],[0,57,470],[3,0,9],[2,13,17],[3,5,23],[3,38,50],[3,26,38],[3,29,41],[3,29,41],[2,77,88],[2,47,57],[2,124,133]], table[S]),
};

const libs = {"@use-gpu/wgsl/fragment/bayer": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=depth.wgsl.js.map
