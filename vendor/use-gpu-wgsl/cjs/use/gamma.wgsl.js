/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("GAMMA toLinear toLinear2 toLinear3 toLinear4 toGamma toGamma2 toGamma3 toGamma4 f32 export vec2<f32> export return".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7,8]),[W]:_([1,2,3,4,5,6,7,8]),[E]:[{[A]:16,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(9),[Z]:_([10]),[P]:[{[N]:"v",[T]:_(9)}],[I]:_([0])}},{[A]:69,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(11),[Z]:_([10]),[P]:[{[N]:"v",[T]:_(11)}],[I]:_([0])}},{[A]:146,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:D,[Z]:_([10]),[P]:[{[N]:"v",[T]:D}],[I]:_([0])}},{[A]:223,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:C,[Z]:_([10]),[P]:[{[N]:"v",[T]:C}],[I]:_([3])}},{[A]:303,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(9),[Z]:_([10]),[P]:[{[N]:"v",[T]:_(9)}],[I]:_([0])}},{[A]:359,[R]:_(6),[G]:1,[F]:{[N]:_(6),[T]:_(11),[Z]:_([10]),[P]:[{[N]:"v",[T]:_(11)}],[I]:_([0])}},{[A]:439,[R]:_(7),[G]:1,[F]:{[N]:_(7),[T]:D,[Z]:_([10]),[P]:[{[N]:"v",[T]:D}],[I]:_([0])}},{[A]:519,[R]:_(8),[G]:1,[F]:{[N]:_(8),[T]:C,[Z]:_([10]),[P]:[{[N]:"v",[T]:C}],[I]:_([7])}}]};
const data = {
  name: "use/gamma",
  code: _(["const ",0,"=2.2;@",10," fn ",1,"(v:f32)->f32{",13," pow(v,",0,");}@",10," fn ",1,"2(v:",11,")->",11,"{",13," pow(v,",11,"(",0,"));}@",10," fn ",1,"3(v:",D,")->",D,"{",13," pow(v,",D,"(",0,"));}@",10," fn ",1,"4(v:",C,")->",C,"{",13," vec4(",1,"3(v.rgb),v.a);}@",10," fn ",5,"(v:f32)->f32{",13," pow(v,1.0/",0,");}@",10," fn ",5,"2(v:",11,")->",11,"{",13," pow(v,",11,"(1.0/",0,"));}@",10," fn ",5,"3(v:",D,")->",D,"{",13," pow(v,",D,"(1.0/",0,"));}@",10," fn ",5,"4(v:",C,")->",C,"{",13," ",C,"(",5,"3(v.rgb),v.a);}\n"]).join(''),
  hash: 0xf58ebdac8290e,
  table,
  shake: [[0,[0,1,2,3,4,5,6,7,8]],[16,[1]],[69,[2]],[146,[3,4]],[223,[4]],[303,[5]],[359,[6]],[439,[7,8]],[519,[8]]],
  tree: decompressAST([[0,0,16],[2,6,11],[0,10,63],[1,0,7],[2,11,19],[2,34,39],[0,8,85],[1,0,7],[2,11,20],[2,57,62],[0,9,86],[1,0,7],[2,11,20],[2,57,62],[0,9,89],[1,0,7],[2,11,20],[2,46,55],[0,23,79],[1,0,7],[2,11,18],[2,37,42],[0,8,88],[1,0,7],[2,11,19],[2,60,65],[0,9,89],[1,0,7],[2,11,19],[2,60,65],[0,9,92],[1,0,7],[2,11,19],[2,50,58]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.toLinear = getSymbol("toLinear");
exports.toLinear2 = getSymbol("toLinear2");
exports.toLinear3 = getSymbol("toLinear3");
exports.toLinear4 = getSymbol("toLinear4");
exports.toGamma = getSymbol("toGamma");
exports.toGamma2 = getSymbol("toGamma2");
exports.toGamma3 = getSymbol("toGamma3");
exports.toGamma4 = getSymbol("toGamma4");
//# sourceMappingURL=gamma.wgsl.js.map
