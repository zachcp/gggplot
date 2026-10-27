/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../use/types.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("applyLight applyLights @use-gpu/wgsl/use/types Light f32 link surface infer(T) export infers".split(' '));
const table = {[S]:_(["T",0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3]),[K]:[{[N]:_(3),[J]:_(3)}]}],[X]:[{[A]:53,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(4),[Z]:_([5]),[P]:[{[N]:"N",[T]:D},{[N]:"V",[T]:D},{[N]:"l",[T]:_(3)},{[N]:_(6),[T]:"T",[Z]:_([7])}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:3}]}}],[E]:[{[A]:132,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:D,[Z]:_([8]),[P]:[{[N]:"N",[T]:D},{[N]:"V",[T]:D},{[N]:"s",[T]:"T"}],[I]:_(["T",0])}}],[_(9)]:_(["T"]),[L]:{[_(0)]:true}};
const data = {
  name: "material/lights-default",
  code: _(["use '",2,"'::{",3,"};@infer ",T," T;@",5," fn ",0,"(N:",D,",V:",D,",l:",3,",@",7,6,":T,)->f32{}@",8," fn ",0,"s(N:",D,",V:",D,",s:T,)->",D,"{var r:",D,"=",D,"(0.0);var l=",3,"(mat4x4<f32>(),mat4x4<f32>(),",C,"(0.0),",C,"(-0.267,-3*0.267,-2*0.267,0.0),",C,"(1.0),",C,"(0.0),0.8,0.0,1,-1,0,vec2<f32>(0.0),",C,"(0.0),",C,"(0.0),);return ",0,"(N,V,l,s);}\n"]).join(''),
  hash: 0xefa4e75409f21,
  table,
  shake: [[39,[0,1,2]],[53,[1,2]],[132,[2]]],
  tree: decompressAST([[1,0,38],[1,39,53],[1,14,93],[0,79,389],[1,0,7],[2,11,22],[2,38,39],[2,52,57],[2,188,198]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.applyLights = getSymbol("applyLights");
//# sourceMappingURL=lights-default.wgsl.js.map
