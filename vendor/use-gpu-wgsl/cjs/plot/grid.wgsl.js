/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getGridValue getGridDirection getGridMin getGridMax getGridShift STEP getGridAutoState getGridPosition f32 link u32 i32 bool optional export return".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7]),[W]:_([7]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(8),[Z]:_([9]),[P]:[{[N]:"i",[T]:_(10)}]}},{[A]:34,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(11),[Z]:_([9])}},{[A]:67,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:C,[Z]:_([9])}},{[A]:100,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:C,[Z]:_([9])}},{[A]:133,[R]:_(4),[G]:2,[F]:{[N]:_(4),[T]:C,[Z]:_([9])}},{[A]:198,[R]:_(6),[G]:6,[F]:{[N]:_(6),[T]:_(12),[Z]:_([13,9]),[P]:[{[N]:"b",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:279,[R]:_(7),[G]:1,[F]:{[N]:_(7),[T]:C,[Z]:_([14]),[P]:[{[N]:"i",[T]:_(10)}],[I]:_([2,3,1,5,4,6,0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true,[_(6)]:true}};
const data = {
  name: "plot/grid",
  code: _(["@",9," fn ",0,"(i:u32)->f32;@",9," fn ",1,"()->i32;@",9," fn ",2,"()->",C,";@",9," fn ",3,"()->",C,";@",9," fn ",4,"()->",C,";const ",5,"=vec2<f32>(0.0,1.0);@",13," @",9," fn ",6,"(b:",C,",s:",C,")->",12,"{",15," true;};@",14," fn ",7,"(i:u32)->",C,"{let n=u32(GRID_LINE_DETAIL+1);let k=i/n;let _1=select(k,k/2,GRID_AUTO);let v=f32(i % n)/f32(n-1u);var b=mix(",2,"(),",3,"(),v);let d=",1,"();var s:",C,";if(d==0){s=",5,".yxxx;}else if(d==1){s=",5,".xyxx;}else if(d==2){s=",5,".xxyx;}else{s=",5,".xxxy;}if(GRID_AUTO){let s1=",4,"();let a=k % 2;if(a==1){b+=s1;}let s2=",6,"(b,select(s1,-s1,a==1),);if(!s2){",15," ",C,"(0.0);}}",15," b+s*",0,"(_1);}\n"]).join(''),
  hash: 0x3a70e0404024c,
  table,
  shake: [[0,[0,7]],[34,[1,7]],[67,[2,7]],[100,[3,7]],[133,[4,7]],[168,[5,7]],[198,[6,7]],[279,[7]]],
  tree: decompressAST([[1,0,33],[1,34,66],[1,33,65],[1,33,65],[1,33,67],[0,35,65],[2,6,10],[4,24,104,6],[1,0,9],[1,10,15],[2,9,25],[0,62,552],[1,0,7],[2,11,26],[2,142,152],[2,13,23],[2,22,38],[2,46,50],[2,27,31],[2,27,31],[2,18,22],[2,32,44],[2,50,66],[2,84,96]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getGridPosition = getSymbol("getGridPosition");
//# sourceMappingURL=grid.wgsl.js.map
