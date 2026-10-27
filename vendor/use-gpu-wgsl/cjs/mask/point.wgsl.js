/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../mask/sdf.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSDF getOutline outlineSDF getFilledMask getOutlinedMask @use-gpu/wgsl/mask/sdf getUVScale scaleSDF f32 link vec2<f32> optional export getUVScale scaleSDF getSDF return export select".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([2,3,4]),[O]:[{[A]:0,[N]:_(5),[S]:_([6,7]),[K]:[{[N]:_(6),[J]:_(6)},{[N]:_(7),[J]:_(7)}]}],[X]:[{[A]:52,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(8),[Z]:_([9]),[P]:[{[N]:"u",[T]:_(10)}]}},{[A]:86,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(8),[Z]:_([11,9])}}],[E]:[{[A]:135,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(8),[Z]:_([12]),[P]:[{[N]:"s",[T]:_(8)},{[N]:"s1",[T]:_(8)}],[I]:_([1])}},{[A]:247,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(8),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(10)}],[I]:_([0])}},{[A]:400,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(8),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(10)}],[I]:_([2,0])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "mask/point",
  code: _(["use '",5,"'::{",6,",",7,"};@",9," fn ",0,"(u:",10,")->f32;@",11," @",9," fn ",1,"()->f32{",16," 0.0;}@",12," fn ",2,"(s:f32,s1:f32)->f32{let o=",1,"();if(o>0){",16," min(s,-s+o*s1);}",16," min(s,0.4-s);}@",12," fn ",3,"(u:",10,")->f32{let l=",0,"(u);let s=",6,"(u);let a=",7,"(l,s);",16," ",18,"(",18,"(0.0,1.0,a>=0.5),a,POINT_SMOOTH);}@",12," fn ",1,"dMask(u:",10,")->f32{let s=",6,"(u);let l=",2,"(",0,"(u),s);let a=",7,"(l,s);",16," ",18,"(",18,"(0.0,1.0,a>=0.5),a,POINT_SMOOTH);}\n"]).join(''),
  hash: 0x1fa8ab28ad4751,
  table,
  shake: [[52,[0,3,4]],[86,[1,2,4]],[135,[2,4]],[247,[3]],[400,[4]]],
  tree: decompressAST([[1,0,51],[1,52,85],[4,34,83,1],[1,0,9],[1,10,15],[2,9,19],[0,30,142],[1,0,7],[2,11,21],[2,36,46],[0,65,218],[1,0,7],[2,11,24],[2,38,44],[2,16,26],[2,20,28],[0,68,237],[1,0,7],[2,11,26],[2,40,50],[2,20,30],[2,11,17],[2,19,27]], table[S]),
};

const libs = {"@use-gpu/wgsl/mask/sdf": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.outlineSDF = getSymbol("outlineSDF");
exports.getFilledMask = getSymbol("getFilledMask");
exports.getOutlinedMask = getSymbol("getOutlinedMask");
//# sourceMappingURL=point.wgsl.js.map
