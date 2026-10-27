/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getOffset getShiftedRectangle vec2<f32> link export".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3])}}],[E]:[{[A]:32,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([4]),[P]:[{[N]:"r",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "layout/shift",
  code: _(["@",3," fn ",0,"()->",2,";@",4," fn ",1,"(r:",C,")->",C,"{let o=",0,"();return ",C,"(r.xy+o,r.zw+o);}\n"]).join(''),
  hash: 0x1402ce23b9b4a,
  table,
  shake: [[0,[0,1]],[32,[1]]],
  tree: decompressAST([[1,0,31],[0,32,138],[1,0,7],[2,11,30],[2,50,59]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getShiftedRectangle = getSymbol("getShiftedRectangle");
//# sourceMappingURL=shift.wgsl.js.map
