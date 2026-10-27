/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTargetMapping getSourceMapping getScratchTexture scratchTexture atlasTexture pmremCopy vec4<u32> link vec2<f32> f32 texture_storage_2d<rgba16float,write> void compute workgroup_size(8,8) export globalId vec3<u32> builtin(global_invocation_id) globalId".split(' '));
const table = {[S]:_([0,1,2,3,4,5]),[W]:_([5]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(6),[Z]:_([7])}},{[A]:41,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(6),[Z]:_([7])}},{[A]:82,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:C,[Z]:_([7]),[P]:[{[N]:"u",[T]:_(8)},{[N]:"l",[T]:_(9)}]}},{[A]:139,[R]:_(3),[G]:2,[V]:{[N]:_(3),[T]:_(10),[Z]:_([7])}},{[A]:202,[R]:_(4),[G]:2,[V]:{[N]:_(4),[T]:_(10),[Z]:_([7])}}],[E]:[{[A]:263,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(11),[Z]:_([12,13,14]),[P]:[{[N]:_(15),[T]:_(16),[Z]:_([17])}],[I]:_([0,1,2,4,3])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true}};
const data = {
  name: "pmrem/pmrem-copy",
  code: _(["@",7," fn ",0,"()->",6,"{};@",7," fn ",1,"()->",6,"{};@",7," fn ",2,"(u:",8,",l:f32)->",C,";@",7," var ",3,":",10,";@",7," var ",4,":",10,";@",12," @",13,"@",14," fn ",5,"(@",17,15,":",16,",){let m=",0,"();let s=m.zw-m.xy;if(any(",15,".xy>=vec2<u32>(s))){return;}let x=vec2<u32>(",15,".xy);let u=",8,"(x)/",8,"(s-1);let _1=u;var s1:",C,";{let m=",1,"();let s=m.zw-m.xy;let _2=_1*",8,"(s-1)+0.5;s1=",2,"(_2,0.0);}textureStore(",4,",x+m.xy,s1);textureStore(",3,",x,s1);}\n"]).join(''),
  hash: 0xbbea2fcf3ab8b,
  table,
  shake: [[0,[0,5]],[41,[1,5]],[82,[2,5]],[139,[3,5]],[202,[4,5]],[263,[5]]],
  tree: decompressAST([[1,0,40],[1,41,81],[1,41,97],[1,57,120],[1,63,124],[0,61,508],[3,0,8],[3,9,29],[1,20,27],[2,11,20],[3,10,40],[2,57,73],[2,174,190],[2,67,84],[2,40,52],[2,37,51]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.pmremCopy = getSymbol("pmremCopy");
//# sourceMappingURL=pmrem-copy.wgsl.js.map
