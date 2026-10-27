/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../codec/octahedral.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture getScale getCubeToOmniSample @use-gpu/wgsl/codec/octahedral decodeOctahedral wrapOctahedral link vec2<f32> optional export".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4,5]),[K]:[{[N]:_(4),[J]:_(4)},{[N]:_(5),[J]:_(5)}]}],[X]:[{[A]:72,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([6]),[P]:[{[N]:"u",[T]:D}]}},{[A]:116,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(7),[Z]:_([8,6])}}],[E]:[{[A]:181,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([9]),[P]:[{[N]:"u",[T]:_(7)}],[I]:_([1,0])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "sample/cube-to-omni",
  code: _(["use '",3,"'::{",4,",",5,"};@",6," fn ",0,"(u:",D,")->",C,";@",8," @",6," fn ",1,"()->",7,"{return ",7,"(1.0);};@",9," fn ",2,"(u:",7,")->",C,"{let o=",5,"((u.xy*2.0-1.0)*",1,"());let _1:",D,"=",4,"(o);return ",0,"(_1);}\n"]).join(''),
  hash: 0x1088af53a353f4,
  table,
  shake: [[72,[0,2]],[116,[1,2]],[181,[2]]],
  tree: decompressAST([[1,0,71],[1,72,115],[4,44,108,1],[1,0,9],[1,10,15],[2,9,17],[0,46,209],[1,0,7],[2,11,30],[2,50,64],[2,30,38],[2,29,45],[2,27,37]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getCubeToOmniSample = getSymbol("getCubeToOmniSample");
//# sourceMappingURL=cube-to-omni.wgsl.js.map
