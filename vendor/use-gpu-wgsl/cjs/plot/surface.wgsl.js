/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../geometry/strip.wgsl");
const m1 = require("../use/array.wgsl");
const m2 = require("../plot/loop.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSize getSurfaceIndex getSurfaceUV @use-gpu/wgsl/geometry/strip getStripIndex @use-gpu/wgsl/use/array sizeToModulus3 packIndex3 unpackIndex3 @use-gpu/wgsl/plot/loop loopSurface vec3<u32> link u32 export sizeToModulus3 unpackIndex3 getSize".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([1,2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]},{[A]:0,[N]:_(5),[S]:_([6,7,8]),[K]:[{[N]:_(6),[J]:_(6)},{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)}]},{[A]:0,[N]:_(9),[S]:_([10]),[K]:[{[N]:_(10),[J]:_(10)}]}],[X]:[{[A]:168,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(11),[Z]:_([12])}}],[E]:[{[A]:200,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(13),[Z]:_([14]),[P]:[{[N]:"i",[T]:_(13)}],[I]:_([0])}},{[A]:540,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([14]),[P]:[{[N]:"i",[T]:_(13)}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "plot/surface",
  code: _(["use '",3,"'::{",4,"};use '",5,"'::{",6,",",7,",un",7,"}use '",9,"'::{",10,"};@",12," fn ",0,"()->",11,"{};@",14," fn ",1,"(i:u32)->u32{let v=i % 6u;let _1=i/6u;let s=",0,"();var d=1u;var d1=1u;if(LOOP_X){d=0u;}if(LOOP_Y){d1=0u;}let s1=s-",11,"(d,d1,0u);let m=",6,"(s1.xyz);var x=",4,"(v-(v/3u)*2u);if(v<3u){x=x.yx;}let x1=",10,"(un",7,"(_1,m),s,vec2<i32>(x));return ",7,"(x1,",6,"(s.xyz));}@",14," fn ",2,"(i:u32)->",C,"{let s=",0,"();let m=",6,"(s);let x=un",7,"(i,m);return ",C,"(",D,"(x)/",D,"(s-1),0.0);}\n"]).join(''),
  hash: 0x4dfe409768e83,
  table,
  shake: [[168,[0,1,2]],[200,[1]],[540,[2]]],
  tree: decompressAST([[1,0,51],[1,52,123],[1,71,115],[1,45,76],[0,32,372],[1,0,7],[2,11,26],[2,59,66],[2,98,112],[2,29,42],[2,51,62],[2,12,24],[2,42,52],[2,14,28],[0,24,181],[1,0,7],[2,11,23],[2,37,44],[2,16,30],[2,24,36]], table[S]),
};

const libs = {"@use-gpu/wgsl/geometry/strip": m0, "@use-gpu/wgsl/use/array": m1, "@use-gpu/wgsl/plot/loop": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getSurfaceIndex = getSymbol("getSurfaceIndex");
exports.getSurfaceUV = getSymbol("getSurfaceUV");
//# sourceMappingURL=surface.wgsl.js.map
