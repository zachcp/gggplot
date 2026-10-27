/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getFaceDetail getFaceSegment i32 optional link export u32 return".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(2),[Z]:_([3,4])}}],[E]:[{[A]:60,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(2),[Z]:_([5]),[P]:[{[N]:"i",[T]:_(6)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "geometry/face",
  code: _(["@",3," @",4," fn ",0,"()->i32{",7," FACE_DETAIL;}@",5," fn ",1,"(i:u32)->i32{let n=u32(",0,"()+2);let _1=i % n;if(_1+2u>=n){",7," 0;}",7," _1+1;};\n"]).join(''),
  hash: 0x19a72eb176a561,
  table,
  shake: [[0,[0,1]],[60,[1]]],
  tree: decompressAST([[4,0,60,0],[1,0,9],[1,10,15],[2,9,22],[0,41,157],[1,0,7],[2,11,25],[2,37,50]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getFaceSegment = getSymbol("getFaceSegment");
//# sourceMappingURL=face.wgsl.js.map
