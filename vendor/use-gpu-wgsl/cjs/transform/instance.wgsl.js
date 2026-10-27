/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getIndirectTransformMatrix getIndirectNormalMatrix getInstanceMap transformMatrix normalMatrix loadInstance getTransformMatrix getNormalMatrix mat4x4<f32> link u32 mat3x3<f32> optional void export mat4x4 mat3x3 return transformMatrix normalMatrix export".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7]),[W]:_([5,6,7]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(8),[Z]:_([9]),[P]:[{[N]:"i",[T]:_(10)}]}},{[A]:56,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(11),[Z]:_([9]),[P]:[{[N]:"i",[T]:_(10)}]}},{[A]:109,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(10),[Z]:_([12,9]),[P]:[{[N]:"i",[T]:_(10)}]}}],[E]:[{[A]:242,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(13),[Z]:_([14]),[P]:[{[N]:"i",[T]:_(10)}],[I]:_([2,3,0,4,1])}},{[A]:387,[R]:_(6),[G]:1,[F]:{[N]:_(6),[T]:_(8),[Z]:_([14]),[I]:_([3])}},{[A]:456,[R]:_(7),[G]:1,[F]:{[N]:_(7),[T]:_(11),[Z]:_([14]),[I]:_([4])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "transform/instance",
  code: _(["@",9," fn ",0,"(i:u32)->",8,";@",9," fn ",1,"(i:u32)->",11,";@",12," @",9," fn ",2,"(i:u32)->u32{",17," i;}var<private>",3,":",8,";var<private>",4,":",11,";@",14," fn ",5,"(i:u32){let _1=",2,"(i);",3,"=",0,"(_1);",4,"=",1,"(_1);}@",14," fn ",6,"()->",8,"{",17," ",3,";}@",14," fn ",7,"()->",11,"{",17," ",4,";}\n"]).join(''),
  hash: 0x11bc6a79786c74,
  table,
  shake: [[0,[0,5]],[56,[1,5]],[109,[2,5]],[165,[3,5,6]],[205,[4,5,7]],[242,[5]],[387,[6]],[456,[7]]],
  tree: decompressAST([[1,0,55],[1,56,108],[4,53,109,2],[1,0,9],[1,10,15],[2,9,23],[0,37,77],[2,12,27],[0,28,65],[2,12,24],[0,25,170],[1,0,7],[2,11,23],[2,27,41],[2,18,33],[2,16,42],[2,31,43],[2,13,36],[0,29,98],[1,0,7],[2,11,29],[2,41,56],[0,17,80],[1,0,7],[2,11,26],[2,38,50]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.loadInstance = getSymbol("loadInstance");
exports.getTransformMatrix = getSymbol("getTransformMatrix");
exports.getNormalMatrix = getSymbol("getNormalMatrix");
//# sourceMappingURL=instance.wgsl.js.map
