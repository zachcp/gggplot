/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getStripIndex getStripUV getStripGridIndex getStripTubeUV getStripGridUV vec2<u32> export u32 vec2<f32> export return getStripGridIndex".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([0,1,2,3,4]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"v",[T]:_(7)}]}},{[A]:89,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(8),[Z]:_([6]),[P]:[{[N]:"v",[T]:_(7)}],[I]:_([0])}},{[A]:165,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"v",[T]:_(7)},{[N]:"d",[T]:_(7)}]}},{[A]:338,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(8),[Z]:_([6]),[P]:[{[N]:"v",[T]:_(7)},{[N]:"d",[T]:_(7)}],[I]:_([2])}},{[A]:464,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(8),[Z]:_([6]),[P]:[{[N]:"v",[T]:_(7)},{[N]:"d",[T]:_(7)}],[I]:_([2])}}]};
const data = {
  name: "geometry/strip",
  code: _(["@",6," fn ",0,"(v:u32)->",5,"{let x=v>>1u;let y=v&1u;",10," ",5,"(x,y);}@",6," fn ",1,"(v:u32)->",8,"{",10," ",8,"(",0,"(v));}@",6," fn ",2,"(v:u32,d:u32)->",5,"{let n=2*(d+3);let i=v/n;let v1=u32(clamp(i32(v % n)-1,0,i32(n-3)));let x=1-(v1&1u)+i;let y=v1>>1;",10," ",5,"(x,y);}@",6," fn ",3,"(v:u32,d:u32)->",8,"{let x=",8,"(",2,"(v,d));",10," ",8,"(x.x,x.y/f32(d+1));}@",6," fn ",4,"(v:u32,d:u32)->",8,"{let x=",8,"(",2,"(v,d));",10," ",8,"(x.x/f32(d+1),x.y/f32(d+1));}\n"]).join(''),
  hash: 0x4b00b2fa9394d,
  table,
  shake: [[0,[0,1]],[89,[1]],[165,[2,3,4]],[338,[3]],[464,[4]]],
  tree: decompressAST([[0,0,89],[1,0,7],[2,11,24],[0,78,154],[1,0,7],[2,11,21],[2,46,59],[0,19,192],[1,0,7],[2,11,28],[0,162,288],[1,0,7],[2,11,25],[2,55,72],[0,60,195],[1,0,7],[2,11,25],[2,55,72]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getStripIndex = getSymbol("getStripIndex");
exports.getStripUV = getSymbol("getStripUV");
exports.getStripGridIndex = getSymbol("getStripGridIndex");
exports.getStripTubeUV = getSymbol("getStripTubeUV");
exports.getStripGridUV = getSymbol("getStripGridUV");
//# sourceMappingURL=strip.wgsl.js.map
