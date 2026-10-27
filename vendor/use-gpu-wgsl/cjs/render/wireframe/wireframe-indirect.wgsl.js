/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("sourceCommand destinationCommand main array<u32> link <storage,read> <storage,read_write> void compute workgroup_size(1) sourceCommand destinationCommand".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:2,[V]:{[N]:_(0),[T]:_(3),[Z]:_([4]),[Q]:_(5)}},{[A]:48,[R]:_(1),[G]:2,[V]:{[N]:_(1),[T]:_(3),[Z]:_([4]),[Q]:_(6)}}],[E]:[{[A]:107,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(7),[Z]:_([8,9]),[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "wireframe/wireframe-indirect",
  code: _(["@",4," var",5,0,":",3,";@",4," var",6,1,":",3,";@",8," @",9,"fn ",2,"(){let v=",0,"[0];let i=",0,"[1];if(isTriangleStrip){let e=(v-2)*2+1;",1,"[0]=4;",1,"[1]=e*i;",1,"[64]=e;}else{",1,"[0]=18;",1,"[1]=v*i;",1,"[64]=v;}}\n"]).join(''),
  hash: 0x19d945ae0476fb,
  table,
  shake: [[0,[0,2]],[48,[1,2]],[107,[2]]],
  tree: decompressAST([[1,0,48],[1,48,107],[0,59,337],[3,0,8],[3,9,27],[2,21,25],[2,13,26],[2,23,36],[2,53,71],[2,24,42],[2,26,44],[2,31,49],[2,25,43],[2,26,44]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=wireframe-indirect.wgsl.js.map
