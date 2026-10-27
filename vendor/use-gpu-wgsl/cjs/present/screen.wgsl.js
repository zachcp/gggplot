/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../use/types.wgsl");
const m1 = require("../geometry/quad.wgsl");
const m2 = require("../use/view.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getRectangle getFill applyMotion applyTransform getScreenVertex @use-gpu/wgsl/use/types SolidVertex @use-gpu/wgsl/geometry/quad getQuadUV @use-gpu/wgsl/use/view worldToClip worldToClip3D to3D getViewResolution getViewSize optional link u32 export SolidVertex worldToClip worldToClip3D optional return applyTransform".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([4]),[O]:[{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]},{[A]:0,[N]:_(7),[S]:_([8]),[K]:[{[N]:_(8),[J]:_(8)}]},{[A]:0,[N]:_(9),[S]:_([10,11,12,13,14]),[K]:[{[N]:_(10),[J]:_(10)},{[N]:_(11),[J]:_(11)},{[N]:_(12),[J]:_(12)},{[N]:_(13),[J]:_(13)},{[N]:_(14),[J]:_(14)}]}],[X]:[{[A]:185,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([15,16]),[P]:[{[N]:"i",[T]:_(17)}]}},{[A]:270,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([15,16]),[P]:[{[N]:"i",[T]:_(17)}]}},{[A]:350,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:C,[Z]:_([15,16]),[P]:[{[N]:"p",[T]:C}]}},{[A]:415,[R]:_(3),[G]:6,[F]:{[N]:_(3),[T]:C,[Z]:_([15,16]),[P]:[{[N]:"p",[T]:C}]}}],[E]:[{[A]:483,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(6),[Z]:_([18]),[P]:[{[N]:"v",[T]:_(17)},{[N]:"i",[T]:_(17)}],[I]:_([0,1,3,2])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "present/screen",
  code: _(["use '",5,"'::{",6,"};use '",7,"'::{",8,"};use '",9,"'::{",10,",",10,"3D,",12,",",13,",",14,"};@",15," @",16," fn ",0,"(i:u32)->",C,"{",23," ",C,"(0.0,0.0,0.0,0.0);}@",15," @",16," fn ",1,"(i:u32)->",C,"{",23," ",C,"(0.5,0.5,0.5,1.0);}@",15," @",16," fn ",2,"(p:",C,")->",C,"{",23," p;}@",15," @",16," fn ",3,"(p:",C,")->",C,"{",23," p;}@",18," fn ",4,"(v:u32,i:u32)->",6,"{var r=",0,"(i);var f=",1,"(i);var u=",8,"(v);var x=u*2.0-1.0;let b=r.zw-r.xy;var _1=",C,"(mix(r.xy,r.zw,u),0.0,1.0);var c=",10,"(",3,"(_1));var c1=",12,"(c);var p=",C,"(mix(r.xy,r.zw,vec2<f32>(1.0-u.x,u.y)),0.0,1.0);var p1=",C,"(mix(r.xy,r.zw,vec2<f32>(u.x,1.0-u.y)),0.0,1.0);var _2=",10,"3D(",3,"(p));var _3=",10,"3D(",3,"(p1));var s=",14,"();var d=(c1.xy-_2.xy)*s;var d1=(c1.xy-_3.xy)*s;var s1=normalize(d);var s2=normalize(d1);let e=(s1+s2)*",13,"();let c2=",D,"(c1.xy+e,c1.z);u=u+x/vec2<f32>(length(d),length(d1));let _4=",C,"((c2.xy*vec2<f32>(1.0,-1.0))*.5+.5,0.0,0.0);var m=",C,"(mix(r.xy,r.zw,u),0.0,1.0);var p2=",10,"(",3,"(",2,"(m)));",23," ",6,"(p2,f,_4,_4,",C,"(1.0),0);}\n"]).join(''),
  hash: 0x2fce88abf560d,
  table,
  shake: [[185,[0,4]],[270,[1,4]],[350,[2,4]],[415,[3,4]],[483,[4]]],
  tree: decompressAST([[1,0,44],[1,45,91],[1,47,139],[4,93,178,0],[1,0,9],[1,10,15],[2,9,21],[4,66,146,1],[1,0,9],[1,10,15],[2,9,16],[4,61,126,2],[1,0,9],[1,10,15],[2,9,20],[4,46,114,3],[1,0,9],[1,10,15],[2,9,23],[0,49,907],[1,0,7],[2,11,26],[2,30,41],[2,18,30],[2,22,29],[2,17,26],[2,94,105],[2,12,26],[2,27,31],[2,142,155],[2,14,28],[2,26,39],[2,14,28],[2,26,37],[2,114,131],[2,198,209],[2,12,26],[2,15,26],[2,24,35]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0, "@use-gpu/wgsl/geometry/quad": m1, "@use-gpu/wgsl/use/view": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getScreenVertex = getSymbol("getScreenVertex");
//# sourceMappingURL=screen.wgsl.js.map
