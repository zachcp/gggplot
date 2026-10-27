/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../codec/normal16.wgsl");
const m1 = require("../use/view.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("loadEdge getSize getColor getInner getOuter LIMIT getOutlineResolve @use-gpu/wgsl/codec/normal16 decodeNormal16 @use-gpu/wgsl/use/view worldToView clipToView viewToClip viewToWorld clipXYToUV clipUVToXY to3D getViewPixelRatio vec2<f32> link vec2<u32> f32 export loadEdge".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6]),[W]:_([6]),[O]:[{[A]:0,[N]:_(7),[S]:_([8]),[K]:[{[N]:_(8),[J]:_(8)}]},{[A]:0,[N]:_(9),[S]:_([10,11,12,13,14,15,16,17]),[K]:[{[N]:_(10),[J]:_(10)},{[N]:_(11),[J]:_(11)},{[N]:_(12),[J]:_(12)},{[N]:_(13),[J]:_(13)},{[N]:_(14),[J]:_(14)},{[N]:_(15),[J]:_(15)},{[N]:_(16),[J]:_(16)},{[N]:_(17),[J]:_(17)}]}],[X]:[{[A]:176,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(18),[Z]:_([19]),[P]:[{[N]:"x",[T]:_(20)}]}},{[A]:218,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(18),[Z]:_([19])}},{[A]:248,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:C,[Z]:_([19])}},{[A]:279,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:_(21),[Z]:_([19])}},{[A]:304,[R]:_(4),[G]:2,[F]:{[N]:_(4),[T]:_(21),[Z]:_([19])}}],[E]:[{[A]:344,[R]:_(6),[G]:1,[F]:{[N]:_(6),[T]:C,[Z]:_([22]),[P]:[{[N]:"t",[T]:_(18)}],[I]:_([1,3,4,2,5,0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true}};
const data = {
  name: "outline/outline-resolve",
  code: _(["use '",7,"'::{",8,"};use '",9,"'::{",10,",",11,",",12,",",13,",",14,",",15,",",16,",",17,"};@",19," fn ",0,"(x:",20,")->",18,";@",19," fn ",1,"()->",18,";@",19," fn ",2,"()->",C,";@",19," fn ",3,"()->f32;@",19," fn ",4,"()->f32;const ",5,"=16;@",22," fn ",6,"(t:",18,")->",C,"{let s=vec2<i32>(t*",1,"());let i=",3,"();let o=",4,"();let c=",2,"();let d=1/f32(i);let d1=1/f32(o);let n=min(",5,",i32(max(i,o)));let e=",0,"(",20,"(s));let e1=",D,"(e.xy,0.0);let _1=clamp(i,0.0,1.0)*max(0.0,e.r-e.g);let o1=clamp(o,0.0,1.0)*e.g;var a=max(_1,o1);for(var _2=1;_2<n;_2++){let e2=",0,"(",20,"(s+vec2<i32>(-_2,0)));let e3=",0,"(",20,"(s+vec2<i32>(_2,0)));let e4=",0,"(",20,"(s+vec2<i32>(0,-_2)));let e5=",0,"(",20,"(s+vec2<i32>(0,_2)));let e6=max(max(e2,e3),max(e4,e5));let f=f32(_2);let _1=clamp(i-f,0.0,1.0)*max(0.0,e6.r-e6.g);let o1=clamp(o-f,0.0,1.0)*e6.g;a+=max(_1,o1);}let a1=clamp(a,0.0,1.0)*c.a;return ",C,"(c.rgb*a1,a1);};\n"]).join(''),
  hash: 0xaff1913db70a2,
  table,
  shake: [[176,[0,6]],[218,[1,6]],[248,[2,6]],[279,[3,6]],[304,[4,6]],[329,[5,6]],[344,[6]]],
  tree: decompressAST([[1,0,52],[1,53,175],[1,123,164],[1,42,71],[1,30,60],[1,31,55],[1,25,49],[0,25,40],[2,6,11],[0,9,754],[1,0,7],[2,11,28],[2,60,67],[2,17,25],[2,17,25],[2,17,25],[2,52,57],[2,27,35],[2,167,175],[2,47,55],[2,46,54],[2,47,55]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/normal16": m0, "@use-gpu/wgsl/use/view": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getOutlineResolve = getSymbol("getOutlineResolve");
//# sourceMappingURL=outline-resolve.wgsl.js.map
