/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../fragment/sdf-2d.wgsl");
const m1 = require("../use/color.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture getMask getScreenFragment @use-gpu/wgsl/fragment/sdf-2d SDF getUVScale getBoxSDF getBorderBoxSDF getRoundedBorderBoxSDF @use-gpu/wgsl/use/color premultiply optional link vec2<f32> export return".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4,5,6,7,8]),[K]:[{[N]:_(4),[J]:_(4)},{[N]:_(5),[J]:_(5)},{[N]:_(6),[J]:_(6)},{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)}]},{[A]:0,[N]:_(9),[S]:_([10]),[K]:[{[N]:_(10),[J]:_(10)}]}],[X]:[{[A]:148,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([11,12]),[P]:[{[N]:"u",[T]:_(13)}]}},{[A]:238,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([11,12]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:323,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([14]),[P]:[{[N]:"f",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}],[I]:_([0,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "present/fragment",
  code: _(["use '",3,"'::{SDF,",5,",",6,",",7,",",8,"};use '",9,"'::{",10,"};@",11," @",12," fn ",0,"(u:",13,")->",C,"{",15," ",C,"(0.0,0.0,0.0,0.0);};@",11," @",12," fn ",1,"(c:",C,",u:",C,",s:",C,")->",C,"{",15," c;}@",14," fn ",2,"(f:",C,",u:",C,",s:",C,",)->",C,"{var t=",0,"(u.xy);var c=",C,"(",10,"(f).rgb*(1.0-t.a)+t.rgb,mix(f.a,1.0,t.a),);if(HAS_MASK){c=",1,"(c,u,s);}",15," c;}\n"]).join(''),
  hash: 0x3f07627f16d3a,
  table,
  shake: [[148,[0,2]],[238,[1,2]],[323,[2]]],
  tree: decompressAST([[1,0,102],[1,103,147],[4,45,134,0],[1,0,9],[1,10,15],[2,9,19],[4,71,156,1],[1,0,9],[1,10,15],[2,9,16],[0,66,278],[1,0,7],[2,11,28],[2,73,83],[2,33,44],[2,69,76]], table[S]),
};

const libs = {"@use-gpu/wgsl/fragment/sdf-2d": m0, "@use-gpu/wgsl/use/color": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getScreenFragment = getSymbol("getScreenFragment");
//# sourceMappingURL=fragment.wgsl.js.map
