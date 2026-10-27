/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../geometry/strip.wgsl");
const m1 = require("../use/array.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSize getPosition getVolumeGradient offsetIndex @use-gpu/wgsl/geometry/strip getStripIndex @use-gpu/wgsl/use/array sizeToModulus4 packIndex4 unpackIndex4 vec4<u32> link u32 optional export packIndex4 getPosition return offsetIndex".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([2]),[O]:[{[A]:0,[N]:_(4),[S]:_([5]),[K]:[{[N]:_(5),[J]:_(5)}]},{[A]:0,[N]:_(6),[S]:_([7,8,9]),[K]:[{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)},{[N]:_(9),[J]:_(9)}]}],[X]:[{[A]:123,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(10),[Z]:_([11]),[P]:[{[N]:"i",[T]:_(12)}]}},{[A]:160,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([13,11]),[P]:[{[N]:"i",[T]:_(12)}]}}],[E]:[{[A]:244,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:D,[Z]:_([14]),[P]:[{[N]:"i",[T]:_(12)}],[I]:_([0,3,1])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "plot/volume",
  code: _(["use '",4,"'::{",5,"};use '",6,"'::{",7,",",8,",un",8,"}@",11," fn ",0,"(i:u32)->",10,"{};@",13," @",11," fn ",1,"(i:u32)->",C,"{",17," ",C,"(0.0,0.0,0.0,0.0);}@",14," fn ",2,"(i:u32)->",D,"{let s=",0,"();let m=",7,"(s);let x=un",8,"(i,m);let l=",8,"(",3,"(x,s,vec3<i32>(-1,0,0)),m);let r=",8,"(",3,"(x,s,vec3<i32>(1,0,0)),m);let t=",8,"(",3,"(x,s,vec3<i32>(0,-1,0)),m);let b=",8,"(",3,"(x,s,vec3<i32>(0,1,0)),m);let f=",8,"(",3,"(x,s,vec3<i32>(0,0,-1)),m);let b1=",8,"(",3,"(x,s,vec3<i32>(0,0,1)),m);let d=",1,"(r)-",1,"(l);let d1=",1,"(b)-",1,"(t);let d2=",1,"(b1)-",1,"(f);let n=",D,"(d,d1,d2);",17," n;}fn ",3,"(i:",10,",s:",10,",o:vec3<i32>)->",10,"{var s1=i32(i.x)+o.x;if(LOOP_X){if(s1<0){s1=s1+i32(s.x);}if(s1>=i32(s.x)){s1=s1-i32(s.x);}}else{if(s1<0){s1=0;}if(s1>=i32(s.x)){s1=i32(s.x)-1;}}var s2=i32(i.y)+o.y;if(LOOP_Y){if(s2<0){s2=s2+i32(s.y);}if(s2>=i32(s.y)){s2=s2-i32(s.y);}}else{if(s2<0){s2=0;}if(s2>=i32(s.y)){s2=i32(s.y)-1;}}var s3=i32(i.z)+o.z;if(LOOP_Z){if(s3<0){s3=s3+i32(s.z);}if(s3>=i32(s.z)){s3=s3-i32(s.z);}}else{if(s3<0){s3=0;}if(s3>=i32(s.z)){s3=i32(s.z)-1;}}",17," ",10,"(u32(s1),u32(s2),u32(s3),i.w);}\n"]).join(''),
  hash: 0x7ed8b1f0ad33,
  table,
  shake: [[123,[0,2]],[160,[1,2]],[244,[2]],[829,[3,2]]],
  tree: decompressAST([[1,0,51],[1,52,123],[1,71,107],[4,37,121,1],[1,0,9],[1,10,15],[2,9,20],[0,65,650],[1,0,7],[2,11,28],[2,42,49],[2,16,30],[2,24,36],[2,24,34],[2,11,22],[2,44,54],[2,11,22],[2,43,53],[2,11,22],[2,44,54],[2,11,22],[2,43,53],[2,11,22],[2,45,55],[2,11,22],[2,43,54],[2,15,26],[2,22,33],[2,15,26],[2,22,33],[2,16,27],[0,50,589],[2,3,14]], table[S]),
};

const libs = {"@use-gpu/wgsl/geometry/strip": m0, "@use-gpu/wgsl/use/array": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getVolumeGradient = getSymbol("getVolumeGradient");
//# sourceMappingURL=volume.wgsl.js.map
