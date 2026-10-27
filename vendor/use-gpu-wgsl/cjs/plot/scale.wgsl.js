/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getScaleValue getScaleDirection getScaleOrigin STEP getScalePosition f32 link u32 i32 export".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([4]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"i",[T]:_(7)}]}},{[A]:35,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(8),[Z]:_([6])}},{[A]:69,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:C,[Z]:_([6])}}],[E]:[{[A]:136,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:C,[Z]:_([9]),[P]:[{[N]:"i",[T]:_(7)}],[I]:_([1,3,2,0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "plot/scale",
  code: _(["@",6," fn ",0,"(i:u32)->f32;@",6," fn ",1,"()->i32;@",6," fn ",2,"()->",C,";const ",3,"=vec2<f32>(0.0,1.0);@",9," fn ",4,"(i:u32)->",C,"{let d=",1,"();var s:",C,";if(d==0){s=",3,".yxxx;}if(d==1){s=",3,".xyxx;}if(d==2){s=",3,".xxyx;}if(d==3){s=",3,".xxxy;}return ",2,"()+s*",0,"(i);}\n"]).join(''),
  hash: 0x44c56f524c35d,
  table,
  shake: [[0,[0,4]],[35,[1,4]],[69,[2,4]],[106,[3,4]],[136,[4]]],
  tree: decompressAST([[1,0,34],[1,35,68],[1,34,70],[0,37,67],[2,6,10],[0,24,244],[1,0,7],[2,11,27],[2,41,58],[2,47,51],[2,22,26],[2,22,26],[2,22,26],[2,18,32],[2,19,32]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getScalePosition = getSymbol("getScalePosition");
//# sourceMappingURL=scale.wgsl.js.map
