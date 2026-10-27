/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("DepthSampleOutput getSample selectDepth selectA selectB main infer(T) link vec2<f32> f32 infer(T1) infer(T2) fragment fragUV location(0) depth builtin(frag_depth) location(1) locals infers DepthSampleOutput location".split(' '));
const table = {[S]:_(["T","T1","T2",0,1,2,3,4,5]),[W]:_([5]),[X]:[{[A]:135,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:{[N]:"T",[Z]:_([6])},[Z]:_([7]),[P]:[{[N]:"u",[T]:_(8)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:179,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(9),[Z]:_([7]),[P]:[{[N]:"v",[T]:"T"}],[I]:_(["T"])}},{[A]:210,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:{[N]:"T1",[Z]:_([10])},[Z]:_([7]),[P]:[{[N]:"v",[T]:"T"}],[I]:_(["T","T1"]),[H]:[{[N]:"T1",[A]:-1}]}},{[A]:246,[R]:_(4),[G]:2,[F]:{[N]:_(4),[T]:{[N]:"T2",[Z]:_([11])},[Z]:_([7]),[P]:[{[N]:"v",[T]:"T"}],[I]:_(["T","T2"]),[H]:[{[N]:"T2",[A]:-1}]}}],[E]:[{[A]:282,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(0),[Z]:_([12]),[P]:[{[N]:_(13),[T]:_(8),[Z]:_([14])}],[I]:_([0,1,0,2,3,4])}}],[_(18)]:[{[A]:44,[R]:_(0),[G]:0,[U]:{[N]:_(0),[M]:[{[N]:_(15),[T]:_(9),[Z]:_([16])},{[N]:"a",[T]:"T1",[Z]:_([14])},{[N]:"b",[T]:"T2",[Z]:_([17])}]}}],[_(19)]:_(["T","T1","T2"]),[L]:{[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true}};
const data = {
  name: "copy/copy-select-depth-sample-2",
  code: _(["@infer ",T," T;@infer ",T," T1;@infer ",T," T2;",U," ",0,"{@builtin(frag_",15,")",15,":f32,@",14,"a:T1,@",17,"b:T2,};@",7," fn ",1,"(u:",8,")->@",6,"T;@",7," fn ",2,"(v:T)->f32;@",7," fn ",3,"(v:T)->@",10,"T1;@",7," fn ",4,"(v:T)->@",11,"T2;@",12," fn ",5,"(@",14,13,":",8,",)->",0,"{let s=",1,"(",13,");return ",0,"(",2,"(s),",3,"(s),",4,"(s),);}\n"]).join(''),
  hash: 0x1c4c42eea870fd,
  table,
  shake: [[0,[0,4,8,5,6,7]],[14,[1,6,8]],[29,[2,7,8]],[44,[3,8]],[135,[4,8]],[179,[5,8]],[210,[6,8]],[246,[7,8]],[282,[8]]],
  tree: decompressAST([[1,0,14],[1,14,29],[1,15,30],[0,15,105],[2,7,24],[3,18,38],[3,30,42],[2,14,16],[3,3,15],[2,14,16],[1,5,48],[1,44,74],[1,31,66],[1,36,71],[0,36,193],[3,0,9],[2,13,17],[3,5,17],[2,32,49],[2,24,33],[2,25,42],[2,18,29],[2,15,22],[2,11,18]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=copy-select-depth-sample-2.wgsl.js.map
