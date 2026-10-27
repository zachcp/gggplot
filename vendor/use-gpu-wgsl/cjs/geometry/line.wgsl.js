/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../use/view.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getLineJoin lineJoinBevel lineJoinMiter lineJoinRound turn slerp @use-gpu/wgsl/use/view screenToClip3D clip3DToScreen export f32 i32 vec2<f32> clip3DToScreen export normalize lineJoinMiter return".split(' '));
const table = {[S]:_([0,1,2,3,4,5]),[W]:_([0,1,2,3]),[O]:[{[A]:0,[N]:_(6),[S]:_([7,8]),[K]:[{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)}]}],[E]:[{[A]:62,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:D,[Z]:_([9]),[P]:[{[N]:"b",[T]:D},{[N]:"c",[T]:D},{[N]:"a",[T]:D},{[N]:"a1",[T]:_(10)},{[N]:"y",[T]:_(10)},{[N]:"s",[T]:_(10)},{[N]:"s1",[T]:_(11)},{[N]:"s2",[T]:_(11)}],[I]:_([4,2,1,3])}},{[A]:673,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(12),[Z]:_([9]),[P]:[{[N]:"l",[T]:_(12)},{[N]:"r",[T]:_(12)},{[N]:"a",[T]:_(10)}]}},{[A]:766,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(12),[Z]:_([9]),[P]:[{[N]:"l",[T]:_(12)},{[N]:"r",[T]:_(12)},{[N]:"a",[T]:_(10)}]}},{[A]:947,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(12),[Z]:_([9]),[P]:[{[N]:"l",[T]:_(12)},{[N]:"r",[T]:_(12)},{[N]:"a",[T]:_(10)}],[I]:_([5])}}]};
const data = {
  name: "geometry/line",
  code: _(["use '",6,"'::{",7,",",8,"};@",9," fn ",0,"(b:",D,",c:",D,",a:",D,",a1:f32,y:f32,s:f32,s1:i32,s2:i32,)->",D,"{let b1=",8,"(b);let c1=",8,"(c);let a2=",8,"(a);let l=",4,"(",15,"(c1-b1));let r=",4,"(",15,"(a2-c1));var m:",12,";if(s1==2){m=l;}else if(s1==1){m=r;}else{if(dot(l,r)<0.999){if(s2==0){m=",2,"(l,r,0.5);}else{let c2=cross(vec3(l,0.0),vec3(r,0.0)).z;if(c2*y<0.0){m=",2,"(l,r,a1);}else{if(s2==1){m=",1,"(l,r,a1);}if(s2==2){m=",2,"(l,r,a1);}if(s2==3){m=",3,"(l,r,a1);}}}}else{m=l;}}let o=s*m*y;let l1=c1+o;re",4," ",7,"(l1,c.z);}@",9," fn ",1,"(l:",12,",r:",12,",a:f32)->",12,"{re",4," select(l,r,a>0.0);}@",9," fn ",2,"(l:",12,",r:",12,",a:f32)->",12,"{if(a==0.0){re",4," l;}if(a==1.0){re",4," r;}let m=",15,"(l+r);let s=min(2.0,1.0/max(0.001,dot(m,l)));re",4," m*s;}@",9," fn ",3,"(l:",12,",r:",12,",a:f32)->",12,"{if(a==0.0){re",4," l;}if(a==1.0){re",4," r;}let d=dot(l,r);if(d>0.999){re",4," l;}re",4," ",5,"(d,l,r,a);}fn ",4,"(x:",12,")->",12,"{re",4," ",12,"(x.y,-x.x);}fn ",5,"(d:f32,a:",12,",b:",12,",t:f32)->",12,"{let t1=acos(d);let a1=sin(vec2((1.0-t)*t1,t*t1));re",4," ",15,"(a*a1.x+b*a1.y);}\n"]).join(''),
  hash: 0x8b0d8462773d2,
  table,
  shake: [[62,[0]],[673,[1,0]],[766,[2,0]],[947,[3,0]],[1116,[4,0]],[1176,[5,3,0]]],
  tree: decompressAST([[1,0,61],[0,62,673],[1,0,7],[2,11,22],[2,101,115],[2,25,39],[2,25,39],[2,24,28],[2,29,33],[2,110,123],[2,84,97],[2,40,53],[2,35,48],[2,35,48],[2,68,82],[0,24,117],[1,0,7],[2,11,24],[0,82,263],[1,0,7],[2,11,24],[0,170,339],[1,0,7],[2,11,24],[2,142,147],[0,16,76],[2,3,7],[0,57,196],[2,3,8]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getLineJoin = getSymbol("getLineJoin");
exports.lineJoinBevel = getSymbol("lineJoinBevel");
exports.lineJoinMiter = getSymbol("lineJoinMiter");
exports.lineJoinRound = getSymbol("lineJoinRound");
//# sourceMappingURL=line.wgsl.js.map
