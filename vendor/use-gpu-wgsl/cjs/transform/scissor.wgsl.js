/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getScissorMin getScissorMax getBounds getScissorBoxLevel link optional export".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([4])}},{[A]:38,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:C,[Z]:_([4])}},{[A]:76,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:C,[Z]:_([5,4])}}],[E]:[{[A]:154,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([6]),[P]:[{[N]:"p",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "transform/scissor",
  code: _(["@",4," fn ",0,"()->",C,"{};@",4," fn ",1,"()->",C,"{};@",5," @",4," fn ",2,"()->",C,"{return ",C,"(0.0,0.0,0.0,0.0);};@",6," fn ",3,"(p:",C,",u:",C,",s:",C,")->",C,"{let s1=",0,"();let s2=",1,"();var v:",C,";if(SCISSOR_BOX_INPUT==1){v=u;}else if(SCISSOR_BOX_INPUT==2){v=s;}else{v=p;}let p1=p-s1;let p2=s2-p;return select(p1,p2,abs(p1)>abs(p2));};\n"]).join(''),
  hash: 0x16d79510ebe7c9,
  table,
  shake: [[0,[0,3]],[38,[1,3]],[76,[2]],[154,[3]]],
  tree: decompressAST([[1,0,37],[1,38,75],[4,38,115,2],[1,0,9],[1,10,15],[2,9,18],[0,59,336],[1,0,7],[2,11,29],[2,74,87],[2,23,36]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getScissorBoxLevel = getSymbol("getScissorBoxLevel");
//# sourceMappingURL=scissor.wgsl.js.map
