/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/view.wgsl");
const m1 = require("../../use/types.wgsl");
const m2 = require("../../geometry/quad.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getLight getInstance getPosition getIndex getScale getDeferredLightVertex @use-gpu/wgsl/use/view worldToClip @use-gpu/wgsl/use/types LightVertex Light @use-gpu/wgsl/geometry/quad getQuadUV link u32 optional f32 export LightVertex optional return".split(' '));
const table = {[S]:_([0,1,2,3,4,5]),[W]:_([5]),[O]:[{[A]:0,[N]:_(6),[S]:_([7]),[K]:[{[N]:_(7),[J]:_(7)}]},{[A]:0,[N]:_(8),[S]:_([9,10]),[K]:[{[N]:_(9),[J]:_(9)},{[N]:_(10),[J]:_(10)}]},{[A]:0,[N]:_(11),[S]:_([12]),[K]:[{[N]:_(12),[J]:_(12)}]}],[X]:[{[A]:142,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(10),[Z]:_([13]),[P]:[{[N]:"i",[T]:_(14)}]}},{[A]:174,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(14),[Z]:_([15,13]),[P]:[{[N]:"i",[T]:_(14)}]}},{[A]:228,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:C,[Z]:_([15,13]),[P]:[{[N]:"i",[T]:_(14)}]}},{[A]:301,[R]:_(3),[G]:6,[F]:{[N]:_(3),[T]:_(14),[Z]:_([15,13]),[P]:[{[N]:"i",[T]:_(14)}]}},{[A]:352,[R]:_(4),[G]:6,[F]:{[N]:_(4),[T]:_(16),[Z]:_([15,13])}}],[E]:[{[A]:400,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(9),[Z]:_([17]),[P]:[{[N]:"v",[T]:_(14)},{[N]:"i",[T]:_(14)}],[I]:_([1,0,2,3,4])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true}};
const data = {
  name: "vertex/deferred-light",
  code: _(["use '",6,"'::{",7,"};use '",8,"'::{",9,",",10,"};use '",11,"'::{",12,"};@",13," fn ",0,"(i:u32)->",10,";@",15," @",13," fn ",1,"(i:u32)->u32{",20," i;};@",15," @",13," fn ",2,"(i:u32)->",C,"{",20," ",C,"(0.0);};@",15," @",13," fn ",3,"(i:u32)->u32{",20," i;};@",15," @",13," fn ",4,"()->f32{",20," 1.0;};@",17," fn ",5,"(v:u32,i:u32)->",9,"{let _1=",1,"(i);if(IS_FULLSCREEN){let u=",12,"(v);let x=u*2.0-1.0;let v1=",C,"(x*2.0+1.0,0.5,1.0);",20," ",9,"(v1,_1);}else{let l=",0,"(_1);var w:",C,";if(l.kind==3){let s=",2,"(",3,"(v));let s1=sqrt(l.intensity*3.1415/l.cutoff)*",4,"();w=",C,"(l.position.xyz+s.xyz*s1,1.0);}let p=",7,"(w);",20," ",9,"(p,_1);}}\n"]).join(''),
  hash: 0x7d4217e6f9ea7,
  table,
  shake: [[142,[0,5]],[174,[1,5]],[228,[2,5]],[301,[3,5]],[352,[4,5]],[400,[5]]],
  tree: decompressAST([[1,0,43],[1,44,94],[1,51,97],[1,47,78],[4,32,85,1],[1,0,9],[1,10,15],[2,9,20],[4,35,107,2],[1,0,9],[1,10,15],[2,9,20],[4,54,104,3],[1,0,9],[1,10,15],[2,9,17],[4,32,79,4],[1,0,9],[1,10,15],[2,9,17],[0,29,454],[1,0,7],[2,11,33],[2,37,48],[2,19,30],[2,39,48],[2,72,83],[2,31,39],[2,49,60],[2,12,20],[2,54,62],[2,59,70],[2,22,33]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0, "@use-gpu/wgsl/use/types": m1, "@use-gpu/wgsl/geometry/quad": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getDeferredLightVertex = getSymbol("getDeferredLightVertex");
//# sourceMappingURL=deferred-light.wgsl.js.map
