/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../mask/sdf.wgsl");
const m1 = require("../use/types.wgsl");
const m2 = require("../use/view.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("traceSphereQuad @use-gpu/wgsl/mask/sdf getUVWScale @use-gpu/wgsl/use/types RTFragment @use-gpu/wgsl/use/view getViewVector worldToDepth worldToW export RTFragment".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[O]:[{[A]:0,[N]:_(1),[S]:_([2]),[K]:[{[N]:_(2),[J]:_(2)}]},{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]},{[A]:0,[N]:_(5),[S]:_([6,7,8]),[K]:[{[N]:_(6),[J]:_(6)},{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)}]}],[E]:[{[A]:156,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(4),[Z]:_([9]),[P]:[{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c",[T]:C}]}}]};
const data = {
  name: "mask/sphere",
  code: _(["use '",1,"'::{",2,"};use '",3,"'::{",4,"};use '",5,"'::{",6,",",7,",",8,"};@",9," fn ",0,"(u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c:",C,",)->",4,"{let c1=t.xyz;let r=t.w;let o=p.xyz;let v=",6,"(p.xyz);let d=normalize(v);let d1=1.414/",2,"(p.xyz);let d2=o-c1;let b=dot(d,d2);let d3=length(d2-b*d);if(d3>r+d1){return ",4,"(p,n,0.0,0.0);}let r1=max(r,d3);let c2=dot(d2,d2)-r1*r1;let d4=max(0.0,b*b-c2);let t1=-(b-sqrt(d4));let s1=r-d3;let a=clamp((s1*d1)+.5,0.0,1.0);let w=o+d*t1;let w1=normalize(w-c1);let o1=",C,"(w,1.0);let o2=",C,"(w1,0.0);let a1=select(select(0.0,1.0,a>=0.5),a,POINT_SMOOTH);let d5=",7,"(o1);return ",4,"(o1,o2,a1,d5);}\n"]).join(''),
  hash: 0x3e8895e971759,
  table,
  shake: [[156,[0]]],
  tree: decompressAST([[1,0,43],[1,44,87],[1,44,111],[0,68,711],[1,0,7],[2,11,26],[2,91,101],[2,52,65],[2,53,64],[2,88,98],[2,299,311],[2,24,34]], table[S]),
};

const libs = {"@use-gpu/wgsl/mask/sdf": m0, "@use-gpu/wgsl/use/types": m1, "@use-gpu/wgsl/use/view": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.traceSphereQuad = getSymbol("traceSphereQuad");
//# sourceMappingURL=sphere.wgsl.js.map
