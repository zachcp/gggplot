/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex getFacet VertexOutput main infer(T) link u32 optional vertex vertexIndex builtin(vertex_index) instanceIndex builtin(instance_index) position builtin(position) fragAlpha f32 location(0) fragUV location(1) fragST location(2) fragNormal location(3) fragTangent location(4) fragPosition location(5) fragScissor location(6) fragFacetId location(7) interpolate(flat) locals infers VertexOutput builtin position location".split(' '));
const table = {[S]:_(["T",0,1,2,3]),[W]:_([3]),[X]:[{[A]:14,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([4])},[Z]:_([5]),[P]:[{[N]:"v",[T]:_(6)},{[N]:"i",[T]:_(6)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:60,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(6),[Z]:_([7,5]),[P]:[{[N]:"i",[T]:_(6)}]}}],[E]:[{[A]:436,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(2),[Z]:_([8]),[P]:[{[N]:_(9),[T]:_(6),[Z]:_([10])},{[N]:_(11),[T]:_(6),[Z]:_([12])}],[I]:_([2,0,2,1])}}],[_(33)]:[{[A]:111,[R]:_(2),[G]:0,[U]:{[N]:_(2),[M]:[{[N]:_(13),[T]:C,[Z]:_([14])},{[N]:_(15),[T]:_(16),[Z]:_([17])},{[N]:_(18),[T]:C,[Z]:_([19])},{[N]:_(20),[T]:C,[Z]:_([21])},{[N]:_(22),[T]:C,[Z]:_([23])},{[N]:_(24),[T]:C,[Z]:_([25])},{[N]:_(26),[T]:C,[Z]:_([27])},{[N]:_(28),[T]:C,[Z]:_([29])},{[N]:_(30),[T]:_(6),[Z]:_([31,32])}]}}],[_(34)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "vertex/virtual-normal",
  code: _(["@infer ",T," T;@",5," fn ",0,"(v:u32,i:u32)->@",4,"T{};@",7," @",5," fn ",1,"(i:u32)->u32{return 0;};",U," ",2,"{@",36,"(",13,")",13,":",C,",@",17,15,":f32,@",19,18,":",C,",@",21,20,":",C,",@",23,22,":",C,",@",25,24,":",C,",@",27,26,":",C,",@",29,28,":",C,",@",31,"@",32,30,":u32,};@",8," fn ",3,"(@",36,"(",8,"_index)",8,"Index:u32,@",12,11,":u32,)->",2,"{let v=",0,"(",8,"Index,",11,");return ",2,"(v.",13,",v.color.a,v.uv,v.st,v.normal,v.tangent,v.world,v.scissor,",1,"(v.index),);}\n"]).join(''),
  hash: 0x11c74b079a43f4,
  table,
  shake: [[0,[0,1,4]],[14,[1,4]],[60,[2,4]],[111,[3,4]],[436,[4]]],
  tree: decompressAST([[1,0,14],[1,14,59],[4,46,96,2],[1,0,9],[1,10,15],[2,9,17],[0,32,356],[2,7,19],[3,13,31],[3,37,49],[3,26,38],[3,29,41],[3,29,41],[3,33,45],[3,34,46],[3,35,47],[3,34,46],[3,12,30],[0,36,300],[3,0,7],[2,11,15],[3,5,27],[3,38,62],[2,45,57],[2,19,28],[2,44,56],[2,81,89]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=virtual-normal.wgsl.js.map
