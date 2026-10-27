/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex VertexOutput main @use-gpu/wgsl/use/types SolidVertex Vertex link u32 vertex vertexIndex builtin(vertex_index) instanceIndex builtin(instance_index) position builtin(position) fragUV vec2<f32> location(0) locals VertexOutput builtin position".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[X]:[{[A]:45,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"v",[T]:_(7)},{[N]:"i",[T]:_(7)}]}}],[E]:[{[A]:175,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(1),[Z]:_([8]),[P]:[{[N]:_(9),[T]:_(7),[Z]:_([10])},{[N]:_(11),[T]:_(7),[Z]:_([12])}],[I]:_([1,0,1])}}],[_(18)]:[{[A]:87,[R]:_(1),[G]:0,[U]:{[N]:_(1),[M]:[{[N]:_(13),[T]:C,[Z]:_([14])},{[N]:_(15),[T]:_(16),[Z]:_([17])}]}}],[L]:{[_(0)]:true}};
const data = {
  name: "vertex/virtual-copy",
  code: _(["use '",3,"'::{",4,"};@",6," fn ",0,"(v:u32,i:u32)->",5,"{};",U," ",1,"{@",20,"(",13,")",13,":",C,",@",17,15,":",16,",};@",8," fn ",2,"(@",20,"(",8,"_index)",8,"Index:u32,@",12,11,":u32,)->",1,"{let v=",0,"(",8,"Index,",11,");return ",1,"(v.",13,",v.uv.xy,);}\n"]).join(''),
  hash: 0x90432512d9ca4,
  table,
  shake: [[45,[0,2]],[87,[1,2]],[175,[2]]],
  tree: decompressAST([[1,0,44],[1,45,86],[0,42,129],[2,7,19],[3,13,31],[3,37,49],[0,31,228],[3,0,7],[2,11,15],[3,5,27],[3,38,62],[2,45,57],[2,19,28],[2,44,56]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=virtual-copy.wgsl.js.map
