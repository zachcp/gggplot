/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex toColorSpace VertexOutput main @use-gpu/wgsl/use/types ShadedVertex link u32 optional vertex vertexIndex builtin(vertex_index) instanceIndex builtin(instance_index) position builtin(position) fragColor location(0) fragUV location(1) fragST location(2) fragNormal location(3) fragTangent location(4) fragPosition location(5) fragScissor location(6) locals VertexOutput builtin position location".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]}],[X]:[{[A]:46,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"v",[T]:_(7)},{[N]:"i",[T]:_(7)}]}},{[A]:94,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([8,6]),[P]:[{[N]:"c",[T]:C}]}}],[E]:[{[A]:445,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(2),[Z]:_([9]),[P]:[{[N]:_(10),[T]:_(7),[Z]:_([11])},{[N]:_(12),[T]:_(7),[Z]:_([13])}],[I]:_([2,0,2,1])}}],[_(30)]:[{[A]:160,[R]:_(2),[G]:0,[U]:{[N]:_(2),[M]:[{[N]:_(14),[T]:C,[Z]:_([15])},{[N]:_(16),[T]:C,[Z]:_([17])},{[N]:_(18),[T]:C,[Z]:_([19])},{[N]:_(20),[T]:C,[Z]:_([21])},{[N]:_(22),[T]:C,[Z]:_([23])},{[N]:_(24),[T]:C,[Z]:_([25])},{[N]:_(26),[T]:C,[Z]:_([27])},{[N]:_(28),[T]:C,[Z]:_([29])}]}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "vertex/virtual-shaded",
  code: _(["use '",4,"'::{",5,"};@",6," fn ",0,"(v:u32,i:u32)->",5,"{};@",8," @",6," fn ",1,"(c:",C,")->",C,"{return c;}",U," ",2,"{@",32,"(",14,")",14,":",C,",@",17,16,":",C,",@",19,18,":",C,",@",21,20,":",C,",@",23,22,":",C,",@",25,24,":",C,",@",27,26,":",C,",@",29,28,":",C,",};@",9," fn ",3,"(@",32,"(",9,"_index)",9,"Index:u32,@",13,12,":u32,)->",2,"{let v=",0,"(",9,"Index,",12,");return ",2,"(v.",14,",",1,"(v.color),v.uv,v.st,v.normal,v.tangent,v.world,v.scissor,);}\n"]).join(''),
  hash: 0xd7d0271e0f670,
  table,
  shake: [[46,[0,3]],[94,[1,3]],[160,[2,3]],[445,[3]]],
  tree: decompressAST([[1,0,45],[1,46,93],[4,48,114,1],[1,0,9],[1,10,15],[2,9,21],[0,47,331],[2,7,19],[3,13,31],[3,37,49],[3,32,44],[3,29,41],[3,29,41],[3,33,45],[3,34,46],[3,35,47],[0,36,294],[3,0,7],[2,11,15],[3,5,27],[3,38,62],[2,45,57],[2,19,28],[2,44,56],[2,24,36]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=virtual-shaded.wgsl.js.map
