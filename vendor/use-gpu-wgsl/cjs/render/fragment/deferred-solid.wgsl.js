/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../codec/octahedral.wgsl");
const m1 = require("../../fragment/bayer.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("GBufferSample getFragment getScissor main @use-gpu/wgsl/codec/octahedral encodeOctahedral @use-gpu/wgsl/fragment/bayer bayer4x4f optional link fragment fragCoord builtin(position) fragColor location(0) fragUV location(1) fragST location(2) fragScissor location(3) albedo normal material emissive locals GBufferSample location return".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]},{[A]:0,[N]:_(6),[S]:_([7]),[K]:[{[N]:_(7),[J]:_(7)}]}],[X]:[{[A]:248,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([8,9]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}]}},{[A]:337,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:C,[Z]:_([8,9]),[P]:[{[N]:"c",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:413,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(0),[Z]:_([10]),[P]:[{[N]:_(11),[T]:C,[Z]:_([12])},{[N]:_(13),[T]:C,[Z]:_([14])},{[N]:_(15),[T]:C,[Z]:_([16])},{[N]:_(17),[T]:C,[Z]:_([18])},{[N]:_(19),[T]:C,[Z]:_([20])}],[I]:_([0,1,2,0])}}],[_(25)]:[{[A]:105,[R]:_(0),[G]:0,[U]:{[N]:_(0),[M]:[{[N]:_(21),[T]:C,[Z]:_([14])},{[N]:_(22),[T]:C,[Z]:_([16])},{[N]:_(23),[T]:C,[Z]:_([18])},{[N]:_(24),[T]:C,[Z]:_([20])}]}}],[L]:{[_(1)]:true,[_(2)]:true}};
const data = {
  name: "fragment/deferred-solid",
  code: _(["use '",4,"'::{",5,"};use '",6,"'::{",7,"};",U," ",0,"{@",14,21,":",C,",@",16,22,":",C,",@",18,23,":",C,",@",20,24,":",C,",};@",8," @",9," fn ",1,"(c:",C,",u:",C,",s:",C,")->",C,"{",28," c;}@",8," @",9," fn ",2,"(c:",C,",s:",C,")->",C,"{",28," c;}@",10," fn ",3,"(@",12,11,":",C,",@",14,13,":",C,",@",16,15,":",C,",@",18,17,":",C,",@",20,19,":",C,",)->",0,"{var o=",1,"(",13,",",15,",",17,");if(HAS_SCISSOR){o=",2,"(o,",19,");}if(HAS_ALPHA_TO_DISCARD){if(o.a<=0.0){discard;}}if(o.a<1.0){let x=vec2<u32>(",11,".xy);if(o.a<",7,"(x)){discard;}}let n=",5,"(",D,"(0.0,0.0,-1.0));",28," ",0,"(",C,"(0.0),",C,"(n,n),",C,"(0.0),",C,"(o.rgb,1.0),);}\n"]).join(''),
  hash: 0x1334486e71310b,
  table,
  shake: [[105,[0,3]],[248,[1,3]],[337,[2,3]],[413,[3]]],
  tree: decompressAST([[1,0,56],[1,57,104],[0,48,190],[2,7,20],[3,14,26],[3,29,41],[3,29,41],[3,31,43],[4,33,122,1],[1,0,9],[1,10,15],[2,9,20],[4,70,146,2],[1,0,9],[1,10,15],[2,9,19],[0,57,601],[3,0,9],[2,13,17],[3,5,23],[3,38,50],[3,32,44],[3,29,41],[3,29,41],[2,37,50],[2,20,31],[2,55,65],[2,124,133],[2,30,46],[2,49,62]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0, "@use-gpu/wgsl/fragment/bayer": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
//# sourceMappingURL=deferred-solid.wgsl.js.map
