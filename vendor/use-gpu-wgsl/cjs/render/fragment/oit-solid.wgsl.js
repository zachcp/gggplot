/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../oit/oit.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getFragment getScissor OITBufferSample main @use-gpu/wgsl/oit/oit getOITSample optional link fragment fragCoord builtin(position) fragColor location(0) fragUV location(1) fragST location(2) fragScissor location(3) color alpha locals return OITBufferSample location".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]}],[X]:[{[A]:44,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([6,7]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}]}},{[A]:133,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([6,7]),[P]:[{[N]:"c",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:290,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(2),[Z]:_([8]),[P]:[{[N]:_(9),[T]:C,[Z]:_([10])},{[N]:_(11),[T]:C,[Z]:_([12])},{[N]:_(13),[T]:C,[Z]:_([14])},{[N]:_(15),[T]:C,[Z]:_([16])},{[N]:_(17),[T]:C,[Z]:_([18])}],[I]:_([2,0,1,2])}}],[_(21)]:[{[A]:209,[R]:_(2),[G]:0,[U]:{[N]:_(2),[M]:[{[N]:_(19),[T]:C,[Z]:_([12])},{[N]:_(20),[T]:C,[Z]:_([14])}]}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "fragment/oit-solid",
  code: _(["use '",4,"'::{",5,"};@",6," @",7," fn ",0,"(c:",C,",u:",C,",s:",C,")->",C,"{",22," c;}@",6," @",7," fn ",1,"(c:",C,",s:",C,")->",C,"{",22," c;}",U," ",2,"{@",12,19,":",C,",@",14,20,":",C,",};@",8," fn ",3,"(@",10,9,":",C,",@",12,11,":",C,",@",14,13,":",C,",@",16,15,":",C,",@",18,17,":",C,",)->",2,"{var o=",11,";o=",0,"(o,",13,",",15,");if(HAS_SCISSOR){o=",1,"(o,",17,");}if(HAS_ALPHA_TO_DISCARD){if(o.a<=0.0){discard;}}let s=",5,"(o,",9,".z);",22," ",2,"(s.",19,",",C,"(s.",20,"));}\n"]).join(''),
  hash: 0x46c002b08f0f7,
  table,
  shake: [[44,[0,3]],[133,[1,3]],[209,[2,3]],[290,[3]]],
  tree: decompressAST([[1,0,43],[4,44,133,0],[1,0,9],[1,10,15],[2,9,20],[4,70,146,1],[1,0,9],[1,10,15],[2,9,19],[0,57,137],[2,7,22],[3,16,28],[3,28,40],[0,30,455],[3,0,9],[2,13,17],[3,5,23],[3,38,50],[3,32,44],[3,29,41],[3,29,41],[2,37,52],[2,34,45],[2,47,57],[2,81,93],[2,35,50]], table[S]),
};

const libs = {"@use-gpu/wgsl/oit/oit": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=oit-solid.wgsl.js.map
