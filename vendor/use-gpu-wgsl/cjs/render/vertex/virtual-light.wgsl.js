/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex VertexOutput main @use-gpu/wgsl/use/types LightVertex link u32 vertex vertexIndex builtin(vertex_index) instanceIndex builtin(instance_index) position builtin(position) lightIndex location(0) interpolate(flat) locals VertexOutput builtin position".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[X]:[{[A]:45,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"i",[T]:_(6)}]}}],[E]:[{[A]:190,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(1),[Z]:_([7]),[P]:[{[N]:_(8),[T]:_(6),[Z]:_([9])},{[N]:_(10),[T]:_(6),[Z]:_([11])}],[I]:_([1,0,1])}}],[_(17)]:[{[A]:86,[R]:_(1),[G]:0,[U]:{[N]:_(1),[M]:[{[N]:_(12),[T]:C,[Z]:_([13])},{[N]:_(14),[T]:_(6),[Z]:_([15,16])}]}}],[L]:{[_(0)]:true}};
const data = {
  name: "vertex/virtual-light",
  code: _(["use '",3,"'::{",4,"};@",5," fn ",0,"(i:u32)->",4,"{};",U," ",1,"{@",19,"(",12,")",12,":",C,",@",15,"@",16,14,":u32,};@",7," fn ",2,"(@",19,"(",7,"_index)",7,"Index:u32,@",11,10,":u32,)->",1,"{let v=",0,"(",7,"Index,",10,");let p=v.",12,";return ",1,"(p,v.index,);}\n"]).join(''),
  hash: 0x55475f2f8d679,
  table,
  shake: [[45,[0,2]],[86,[1,2]],[190,[2]]],
  tree: decompressAST([[1,0,44],[1,45,85],[0,41,144],[2,7,19],[3,13,31],[3,37,49],[3,12,30],[0,35,240],[3,0,7],[2,11,15],[3,5,27],[3,38,62],[2,45,57],[2,19,28],[2,61,73]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=virtual-light.wgsl.js.map
