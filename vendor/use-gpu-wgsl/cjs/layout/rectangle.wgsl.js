/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("applyTransform transformRectangle optional link export applyTransform".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([2,3]),[P]:[{[N]:"p",[T]:C}]}}],[E]:[{[A]:68,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:C,[Z]:_([4]),[P]:[{[N]:"r",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "layout/rectangle",
  code: _(["@",2," @",3," fn ",0,"(p:",C,")->",C,"{return p;}@",4," fn ",1,"(r:",C,")->",C,"{let u=",0,"(",C,"(r.xy,0.5,1.0));let b=",0,"(",C,"(r.zw,0.5,1.0));return ",C,"(u.xy,b.xy);}\n"]).join(''),
  hash: 0x3e5c53d1fc5d5,
  table,
  shake: [[0,[0,1]],[68,[1]]],
  tree: decompressAST([[4,0,68,0],[1,0,9],[1,10,15],[2,9,23],[0,49,224],[1,0,7],[2,11,29],[2,49,63],[2,46,60]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.transformRectangle = getSymbol("transformRectangle");
//# sourceMappingURL=rectangle.wgsl.js.map
