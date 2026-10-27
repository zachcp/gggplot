/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture getSize getOffset textureUVToXYOffset infer(T) link vec2<u32> vec2<f32> optional export infers".split(' '));
const table = {[S]:_(["T",0,1,2,3]),[W]:_([3]),[X]:[{[A]:14,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([4])},[Z]:_([5]),[P]:[{[N]:"u",[T]:_(6)}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:59,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(7),[Z]:_([5])}},{[A]:89,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(6),[Z]:_([8,5])}}],[E]:[{[A]:153,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:"T",[Z]:_([9]),[P]:[{[N]:"u",[T]:_(7)}],[I]:_(["T",1,2,0])}}],[_(10)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "texture/raw-offset",
  code: _(["@infer ",T," T;@",5," fn ",0,"(u:",6,")->@",4,"T;@",5," fn ",1,"()->",7,";@",8," @",5," fn ",2,"()->",6,"{return ",6,"(0);};@",9," fn ",3,"(u:",7,")->T{let x=",6,"(u.xy*",1,"())+",2,"();return ",0,"(x);}\n"]).join(''),
  hash: 0x8d1f93d08c4db,
  table,
  shake: [[0,[0,1,4]],[14,[1,4]],[59,[2,4]],[89,[3,4]],[153,[4]]],
  tree: decompressAST([[1,0,14],[1,14,58],[1,45,74],[4,30,93,3],[1,0,9],[1,10,15],[2,9,18],[0,45,158],[1,0,7],[2,11,30],[2,34,35],[2,23,30],[2,11,20],[2,19,29]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.textureUVToXYOffset = getSymbol("textureUVToXYOffset");
//# sourceMappingURL=raw-offset.wgsl.js.map
