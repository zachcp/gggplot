/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../fragment/bayer.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getDepth getScissor main @use-gpu/wgsl/fragment/bayer bayer4x4f infer(T) link f32 optional builtin(frag_depth) fragment fragCoord builtin(position) fragAlpha location(0) fragUV location(1) fragST location(2) fragPosition location(3) fragScissor location(4) infers location".split(' '));
const table = {[S]:_(["T",0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[X]:[{[A]:62,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([5])},[Z]:_([6]),[P]:[{[N]:"a",[T]:_(7)},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"p",[T]:C}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:138,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([8,6]),[P]:[{[N]:"c",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:214,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:{[N]:_(7),[Z]:_([9])},[Z]:_([10]),[P]:[{[N]:_(11),[T]:C,[Z]:_([12])},{[N]:_(13),[T]:_(7),[Z]:_([14])},{[N]:_(15),[T]:C,[Z]:_([16])},{[N]:_(17),[T]:C,[Z]:_([18])},{[N]:_(19),[T]:C,[Z]:_([20])},{[N]:_(21),[T]:C,[Z]:_([22])}],[I]:_([0,1])}}],[_(23)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "fragment/depth-only",
  code: _(["use '",3,"'::{",4,"};@infer ",T," T;@",6," fn ",0,"(a:f32,u:",C,",s:",C,",p:",C,",)->@",5,"T{};@",8," @",6," fn ",1,"(c:",C,",s:",C,")->",C,"{return c;}@",10," fn ",2,"(@",12,11,":",C,",@",14,13,":f32,@",16,15,":",C,",@",18,17,":",C,",@",20,19,":",C,",@",22,21,":",C,",)->@",9,"f32{var f=",0,"(",13,",",15,",",17,",",19,");var o=",C,"(0.0,0.0,0.0,f.alpha);if(HAS_SCISSOR){o=",1,"(o,",21,");}if(HAS_ALPHA_TO_DISCARD){if(o.a<=0.0){discard;}}if(o.a<1.0){let x=vec2<u32>(",11,".xy);if(o.a<",4,"(x)){discard;}}return f.depth;}\n"]).join(''),
  hash: 0x1da5232143b93a,
  table,
  shake: [[48,[0,1,3]],[62,[1,3]],[138,[2,3]],[214,[3]]],
  tree: decompressAST([[1,0,47],[1,48,62],[1,14,89],[4,76,152,2],[1,0,9],[1,10,15],[2,9,19],[0,57,565],[3,0,9],[2,13,17],[3,5,23],[3,38,50],[3,26,38],[3,29,41],[3,29,41],[3,35,47],[3,37,57],[2,30,38],[2,102,112],[2,124,133]], table[S]),
};

const libs = {"@use-gpu/wgsl/fragment/bayer": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=depth-only.wgsl.js.map
