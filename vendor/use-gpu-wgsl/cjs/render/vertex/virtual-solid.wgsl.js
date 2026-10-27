/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/types.wgsl");
const m1 = require("../../use/color.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex toColorSpace VertexOutput main @use-gpu/wgsl/use/types SolidVertex @use-gpu/wgsl/use/color premultiply link u32 optional vertex vertexIndex builtin(vertex_index) instanceIndex builtin(instance_index) position builtin(position) fragColor location(0) fragUV location(1) fragST location(2) fragScissor location(3) locals VertexOutput builtin position location".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]},{[A]:0,[N]:_(6),[S]:_([7]),[K]:[{[N]:_(7),[J]:_(7)}]}],[X]:[{[A]:90,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(5),[Z]:_([8]),[P]:[{[N]:"v",[T]:_(9)},{[N]:"i",[T]:_(9)}]}},{[A]:137,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([10,8]),[P]:[{[N]:"c",[T]:C}]}}],[E]:[{[A]:386,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(2),[Z]:_([11]),[P]:[{[N]:_(12),[T]:_(9),[Z]:_([13])},{[N]:_(14),[T]:_(9),[Z]:_([15])}],[I]:_([2,0,2,1])}}],[_(26)]:[{[A]:203,[R]:_(2),[G]:0,[U]:{[N]:_(2),[M]:[{[N]:_(16),[T]:C,[Z]:_([17])},{[N]:_(18),[T]:C,[Z]:_([19])},{[N]:_(20),[T]:C,[Z]:_([21])},{[N]:_(22),[T]:C,[Z]:_([23])},{[N]:_(24),[T]:C,[Z]:_([25])}]}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "vertex/virtual-solid",
  code: _(["use '",4,"'::{",5,"};use '",6,"'::{",7,"};@",8," fn ",0,"(v:u32,i:u32)->",5,"{};@",10," @",8," fn ",1,"(c:",C,")->",C,"{return c;}",U," ",2,"{@",28,"(",16,")",16,":",C,",@",19,18,":",C,",@",21,20,":",C,",@",23,22,":",C,",@",25,24,":",C,",};@",11," fn ",3,"(@",28,"(",11,"_index)",11,"Index:u32,@",15,14,":u32,)->",2,"{let v=",0,"(",11,"Index,",14,");return ",2,"(v.",16,",",1,"(v.color),v.uv,v.st,v.scissor,);}\n"]).join(''),
  hash: 0x8ea85f50e4419,
  table,
  shake: [[90,[0,3]],[137,[1,3]],[203,[2,3]],[386,[3]]],
  tree: decompressAST([[1,0,44],[1,45,89],[1,45,91],[4,47,113,1],[1,0,9],[1,10,15],[2,9,21],[0,47,229],[2,7,19],[3,13,31],[3,37,49],[3,32,44],[3,29,41],[3,29,41],[0,36,267],[3,0,7],[2,11,15],[3,5,27],[3,38,62],[2,45,57],[2,19,28],[2,44,56],[2,24,36]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0, "@use-gpu/wgsl/use/color": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=virtual-solid.wgsl.js.map
