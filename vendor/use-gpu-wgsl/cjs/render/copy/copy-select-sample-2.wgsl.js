/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("SampleOutput getSample selectA selectB main infer(T) link vec2<f32> infer(T1) infer(T2) fragment fragUV location(0) location(1) locals infers SampleOutput location".split(' '));
const table = {[S]:_(["T","T1","T2",0,1,2,3,4]),[W]:_([4]),[X]:[{[A]:100,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:{[N]:"T",[Z]:_([5])},[Z]:_([6]),[P]:[{[N]:"u",[T]:_(7)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:144,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:{[N]:"T1",[Z]:_([8])},[Z]:_([6]),[P]:[{[N]:"v",[T]:"T"}],[I]:_(["T","T1"]),[H]:[{[N]:"T1",[A]:-1}]}},{[A]:180,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:{[N]:"T2",[Z]:_([9])},[Z]:_([6]),[P]:[{[N]:"v",[T]:"T"}],[I]:_(["T","T2"]),[H]:[{[N]:"T2",[A]:-1}]}}],[E]:[{[A]:216,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(0),[Z]:_([10]),[P]:[{[N]:_(11),[T]:_(7),[Z]:_([12])}],[I]:_([0,1,0,2,3])}}],[_(14)]:[{[A]:44,[R]:_(0),[G]:0,[U]:{[N]:_(0),[M]:[{[N]:"a",[T]:"T1",[Z]:_([12])},{[N]:"b",[T]:"T2",[Z]:_([13])}]}}],[_(15)]:_(["T","T1","T2"]),[L]:{[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "copy/copy-select-sample-2",
  code: _(["@infer ",T," T;@infer ",T," T1;@infer ",T," T2;",U," ",0,"{@",12,"a:T1,@",13,"b:T2,};@",6," fn ",1,"(u:",7,")->@",5,"T;@",6," fn ",2,"(v:T)->@",8,"T1;@",6," fn ",3,"(v:T)->@",9,"T2;@",10," fn ",4,"(@",12,11,":",7,",)->",0,"{let s=",1,"(",11,");return ",0,"(",2,"(s),",3,"(s),);}\n"]).join(''),
  hash: 0xafa4441befc3f,
  table,
  shake: [[0,[0,4,7,5,6]],[14,[1,5,7]],[29,[2,6,7]],[44,[3,7]],[100,[4,7]],[144,[5,7]],[180,[6,7]],[216,[7]]],
  tree: decompressAST([[1,0,14],[1,14,29],[1,15,30],[0,15,70],[2,7,19],[3,13,25],[2,14,16],[3,3,15],[2,14,16],[1,5,48],[1,44,79],[1,36,71],[0,36,168],[3,0,9],[2,13,17],[3,5,17],[2,32,44],[2,19,28],[2,25,37],[2,13,20],[2,11,18]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=copy-select-sample-2.wgsl.js.map
