/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../geometry/normal.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("transformPosition getEpsilon getEpsilonDifferential @use-gpu/wgsl/geometry/normal getOrthoVector link f32 optional export bool transformPosition return".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[X]:[{[A]:54,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([5]),[P]:[{[N]:"p",[T]:C}]}},{[A]:105,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(6),[Z]:_([7,5])}}],[E]:[{[A]:157,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([8]),[P]:[{[N]:"v",[T]:C},{[N]:"o",[T]:C},{[N]:"c",[T]:_(9)}],[I]:_([1,0])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "transform/diff-epsilon",
  code: _(["use '",3,"'::{",4,"};@",5," fn ",0,"(p:",C,")->",C,";@",7," @",5," fn ",1,"()->f32{",11," 0.001;};@",8," fn ",1,"Differential(v:",C,",o:",C,",c:",9,")->",C,"{let e=",1,"();if(c){let n=",4,"(v.xyz);let n1=cross(v.xyz,n);let a=",0,"(o).xyz;let b=",0,"(o+",C,"(n.xyz*e,0.0)).xyz;let c1=",0,"(o+",C,"(n1.xyz*e,0.0)).xyz;let n2=cross(b-a,c1-a);",11," ",C,"(normalize(n2),v.w);}let a=",0,"(o).xyz;let b=",0,"(o+",C,"(v.xyz*e,0.0)).xyz;",11," ",C,"((b-a)/e,v.w);}\n"]).join(''),
  hash: 0xda8afc8f43dc7,
  table,
  shake: [[54,[0,2]],[105,[1,2]],[157,[2]]],
  tree: decompressAST([[1,0,53],[1,54,104],[4,51,102,1],[1,0,9],[1,10,15],[2,9,19],[0,33,502],[1,0,7],[2,11,33],[2,72,82],[2,25,39],[2,50,67],[2,31,48],[2,55,72],[2,115,132],[2,31,48]], table[S]),
};

const libs = {"@use-gpu/wgsl/geometry/normal": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getEpsilonDifferential = getSymbol("getEpsilonDifferential");
//# sourceMappingURL=diff-epsilon.wgsl.js.map
