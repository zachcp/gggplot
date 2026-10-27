/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../fragment/bayer.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSurface getScissor main @use-gpu/wgsl/fragment/bayer bayer4x4f infer(T) link optional f32 builtin(frag_depth) fragment export frontFacing bool builtin(front_facing) fragCoord builtin(position) fragColor location(0) fragUV location(1) fragST location(2) fragNormal location(3) fragTangent location(4) fragPosition location(5) fragScissor location(6) infers builtin location".split(' '));
const table = {[S]:_(["T",0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[X]:[{[A]:62,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([5])},[Z]:_([6]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:182,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([7,6]),[P]:[{[N]:"c",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:258,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:{[N]:_(8),[Z]:_([9])},[Z]:_([10,11]),[P]:[{[N]:_(12),[T]:_(13),[Z]:_([14])},{[N]:_(15),[T]:C,[Z]:_([16])},{[N]:_(17),[T]:C,[Z]:_([18])},{[N]:_(19),[T]:C,[Z]:_([20])},{[N]:_(21),[T]:C,[Z]:_([22])},{[N]:_(23),[T]:C,[Z]:_([24])},{[N]:_(25),[T]:C,[Z]:_([26])},{[N]:_(27),[T]:C,[Z]:_([28])},{[N]:_(29),[T]:C,[Z]:_([30])}],[I]:_([0,1])}}],[_(31)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "fragment/depth-shaded",
  code: _(["use '",3,"'::{",4,"};@infer ",T," T;@",6," fn ",0,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->@",5,"T{}@",7," @",6," fn ",1,"(c:",C,",s:",C,")->",C,"{return c;}@",10," @",11," fn ",2,"(@",14,12,":",13,",@",16,15,":",C,",@",18,17,":",C,",@",20,19,":",C,",@",22,21,":",C,",@",24,23,":",C,",@",26,25,":",C,",@",28,27,":",C,",@",30,29,":",C,",)->@",9,"f32{var n=",23,";if(!",12,"){n=",C,"(-n.xyz,n.w);}var o=",17,";let s=",0,"(o,",19,",",21,",n,",25,",",27,",",15,");o=s.albedo;if(HAS_SCISSOR){o=",1,"(o,",29,");}if(HAS_ALPHA_TO_DISCARD){if(o.a<=0.0){discard;}}return s.depth;}\n"]).join(''),
  hash: 0x16d5b40b9cd909,
  table,
  shake: [[48,[0,1,3]],[62,[1,3]],[182,[2,3]],[258,[3]]],
  tree: decompressAST([[1,0,47],[1,48,62],[1,14,134],[4,120,196,2],[1,0,9],[1,10,15],[2,9,19],[0,57,679],[3,0,9],[1,10,17],[2,11,15],[3,5,27],[3,39,57],[3,38,50],[3,32,44],[3,29,41],[3,29,41],[3,33,45],[3,34,46],[3,35,47],[3,37,57],[2,105,115],[2,94,104]], table[S]),
};

const libs = {"@use-gpu/wgsl/fragment/bayer": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=depth-shaded.wgsl.js.map
