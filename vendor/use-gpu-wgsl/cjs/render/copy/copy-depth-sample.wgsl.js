/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("DepthSampleOutput getDepth getSample main f32 link vec2<f32> infer(T) fragment fragUV location(0) depth builtin(frag_depth) sample locals infers DepthSampleOutput fragUV".split(' '));
const table = {[S]:_(["T",0,1,2,3]),[W]:_([3]),[X]:[{[A]:92,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"u",[T]:_(6)}]}},{[A]:128,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:{[N]:"T",[Z]:_([7])},[Z]:_([5]),[P]:[{[N]:"u",[T]:_(6)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}}],[E]:[{[A]:172,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(0),[Z]:_([8]),[P]:[{[N]:_(9),[T]:_(6),[Z]:_([10])}],[I]:_([0,0,1,2])}}],[_(14)]:[{[A]:14,[R]:_(0),[G]:0,[U]:{[N]:_(0),[M]:[{[N]:_(11),[T]:_(4),[Z]:_([12])},{[N]:_(13),[T]:"T",[Z]:_([10])}]}}],[_(15)]:_(["T"]),[L]:{[_(1)]:true,[_(2)]:true}};
const data = {
  name: "copy/copy-depth-sample",
  code: _(["@infer ",T," T;",U," ",0,"{@builtin(frag_",11,")",11,":f32,@",10,13,":T,};@",5," fn ",1,"(u:",6,")->f32;@",5," fn ",2,"(u:",6,")->@",7,"T;@",8," fn ",3,"(@",10,9,":",6,",)->",0,"{return ",0,"(",1,"(",9,"),",2,"(",9,"),);}\n"]).join(''),
  hash: 0xd919bb799e1a1,
  table,
  shake: [[0,[0,3,4]],[14,[1,4]],[92,[2,4]],[128,[3,4]],[172,[4]]],
  tree: decompressAST([[1,0,14],[0,14,91],[2,7,24],[3,18,38],[3,30,42],[2,19,20],[1,4,39],[1,36,79],[0,44,175],[3,0,9],[2,13,17],[3,5,17],[2,32,49],[2,25,42],[2,18,26],[2,17,26]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=copy-depth-sample.wgsl.js.map
