/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("depthWeight depthWeightPlus normalWeight facetWeight f32 export u32 export return select".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([0,1,2,3]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"a",[T]:_(4)},{[N]:"b",[T]:_(4)}]}},{[A]:132,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"c",[T]:_(4)},{[N]:"l",[T]:_(4)},{[N]:"r",[T]:_(4)},{[N]:"t",[T]:_(4)},{[N]:"b",[T]:_(4)}],[I]:_([0])}},{[A]:254,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"a",[T]:D},{[N]:"b",[T]:D}]}},{[A]:370,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"a",[T]:_(6)},{[N]:"b",[T]:_(6)}]}}]};
const data = {
  name: "outline/outline-weight",
  code: _(["@",5," fn ",0,"(a:f32,b:f32)->f32{",8," max(0.0,min(",9,"(0.0,a/b,b>0),",9,"(0.0,b/a,a>0),)*DEPTH_RAMP-(DEPTH_RAMP-1.0));}@",5," fn ",0,"Plus(c:f32,l:f32,r:f32,t:f32,b:f32)->f32{let a=(l+r+t+b)/4.0;",8," min(1.0,",0,"(c,a)*1.02);}@",5," fn ",2,"(a:",D,",b:",D,")->f32{",8," clamp(dot(a,b)*NORMAL_RAMP-(NORMAL_RAMP-1.0),0.0,1.0);}@",5," fn ",3,"(a:u32,b:u32)->f32{",8," ",9,"(1.0,0.0,a !=b);}\n"]).join(''),
  hash: 0x145101f43d426,
  table,
  shake: [[0,[0,1]],[132,[1]],[254,[2]],[370,[3]]],
  tree: decompressAST([[0,0,132],[1,0,7],[2,11,22],[0,121,243],[1,0,7],[2,11,26],[2,87,98],[0,24,140],[1,0,7],[2,11,23],[0,105,176],[1,0,7],[2,11,22]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.depthWeight = getSymbol("depthWeight");
exports.depthWeightPlus = getSymbol("depthWeightPlus");
exports.normalWeight = getSymbol("normalWeight");
exports.facetWeight = getSymbol("facetWeight");
//# sourceMappingURL=outline-weight.wgsl.js.map
