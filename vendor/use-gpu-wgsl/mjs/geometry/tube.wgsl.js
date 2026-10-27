/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../use/view.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("PositionNormal getTubeJoin tubeJoinTangent tubeJoinBevel tubeJoinMiter tubeJoinRound slerp @use-gpu/wgsl/use/view getViewVector export f32 i32 position normal locals PositionNormal export normalize tubeJoinTangent tubeJoinMiter return".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6]),[W]:_([1,2,3,4,5]),[O]:[{[A]:0,[N]:_(7),[S]:_([8]),[K]:[{[N]:_(8),[J]:_(8)}]}],[E]:[{[A]:106,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(0),[Z]:_([9]),[P]:[{[N]:"b",[T]:C},{[N]:"c",[T]:C},{[N]:"a",[T]:C},{[N]:"a1",[T]:_(10)},{[N]:"y",[T]:_(10)},{[N]:"s",[T]:_(10)},{[N]:"s1",[T]:_(11)},{[N]:"s2",[T]:_(11)}],[I]:_([0,2,4,3,5,0])}},{[A]:755,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:D,[Z]:_([9]),[P]:[{[N]:"v",[T]:D},{[N]:"t",[T]:D},{[N]:"y",[T]:_(10)}]}},{[A]:968,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:D,[Z]:_([9]),[P]:[{[N]:"v",[T]:D},{[N]:"l",[T]:D},{[N]:"r",[T]:D},{[N]:"a",[T]:_(10)},{[N]:"y",[T]:_(10)}],[I]:_([2])}},{[A]:1108,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:D,[Z]:_([9]),[P]:[{[N]:"v",[T]:D},{[N]:"l",[T]:D},{[N]:"r",[T]:D},{[N]:"a",[T]:_(10)},{[N]:"y",[T]:_(10)}],[I]:_([2])}},{[A]:1447,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:D,[Z]:_([9]),[P]:[{[N]:"v",[T]:D},{[N]:"l",[T]:D},{[N]:"r",[T]:D},{[N]:"a",[T]:_(10)},{[N]:"y",[T]:_(10)}],[I]:_([6,2])}}],[_(14)]:[{[A]:46,[R]:_(0),[G]:0,[U]:{[N]:_(0),[M]:[{[N]:_(12),[T]:D},{[N]:_(13),[T]:D}]}}]};
const data = {
  name: "geometry/tube",
  code: _(["use '",7,"'::{",8,"};",U," ",0,"{",12,":",D,",",13,":",D,",};@",9," fn ",1,"(b:",C,",c:",C,",a:",C,",a1:f32,y:f32,s:f32,s1:i32,s2:i32,)->",0,"{let v=",13,"ize(",8,"(c.xyz));let l=",13,"ize(c.xyz-b.xyz);let r=",13,"ize(a.xyz-c.xyz);var m:",D,";if(s1==2){m=",2,"(v,l,y);}else if(s1==1){m=",2,"(v,r,y);}else{if(dot(l,r)<0.999){if(s2==0){m=",4,"(v,l,r,0.5,y);}else{let c1=dot(cross(l,r),v);if(c1*y>0.0){m=",4,"(v,l,r,0.5,y);}else{if(s2==1){m=",3,"(v,l,r,a1,y);}if(s2==2){m=",4,"(v,l,r,a1,y);}if(s2==3){m=",5,"(v,l,r,a1,y);}}}}else{m=",4,"(v,l,r,0.5,y);}}let o=s*m;let t=c.xyz+o;",20," ",0,"(t,o);}@",9," fn ",2,"(v:",D,",t:",D,",y:f32,)->",D,"{let b=",13,"ize(cross(t,v)+",D,"(0.0,0.0,1e-5));let b1=cross(t,b);let t1=(y+1.0)*1.5707963268;let c=cos(t1);let s=sin(t1);",20," c*b-s*b1;}@",9," fn ",3,"(v:",D,",l:",D,",r:",D,",a:f32,y:f32)->",D,"{let t=select(l,r,a>0.0);",20," ",2,"(v,t,y);}@",9," fn ",4,"(v:",D,",l:",D,",r:",D,",a:f32,y:f32)->",D,"{var t:",D,";var b=0.0;if(a==0.0){t=l;}else if(a==1.0){t=r;}else{t=",13,"ize(l+r);b=min(2.0,1.0/max(0.001,dot(t,l)))-1.0;}let o=",2,"(v,t,y);let p=cross(l,r);if(length(p)>0.0){let p1=",13,"ize(p);let i=o-p1*dot(o,p1);",20," o+b*i;}",20," o;}@",9," fn ",5,"(v:",D,",l:",D,",r:",D,",a:f32,y:f32)->",D,"{var t:",D,";if(a==0.0){t=l;}else if(a==1.0){t=r;}else{let d=dot(l,r);if(d>0.999){t=l;}else{t=",6,"(d,l,r,a);}}",20," ",2,"(v,t,y);}fn ",6,"(d:f32,a:",D,",b:",D,",t:f32)->",D,"{let t1=acos(d);let a1=sin(vec2((1.0-t)*t1,t*t1));",20," ",13,"ize(a*a1.x+b*a1.y);}\n"]).join(''),
  hash: 0x16089b80b8d2a8,
  table,
  shake: [[46,[0,1]],[106,[1]],[755,[2,1,3,4,5]],[968,[3,1]],[1108,[4,1]],[1447,[5,1]],[1677,[6,5,1]]],
  tree: decompressAST([[1,0,45],[0,46,105],[2,7,21],[0,53,702],[1,0,7],[2,11,22],[2,84,98],[2,31,44],[2,108,123],[2,41,56],[2,60,73],[2,73,86],[2,45,58],[2,39,52],[2,39,52],[2,37,50],[2,60,74],[0,21,234],[1,0,7],[2,11,26],[0,202,342],[1,0,7],[2,11,24],[2,105,120],[0,24,363],[1,0,7],[2,11,24],[2,205,220],[0,123,353],[1,0,7],[2,11,24],[2,171,176],[2,24,39],[0,24,163],[2,3,8]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getTubeJoin = getSymbol("getTubeJoin");
export const tubeJoinTangent = getSymbol("tubeJoinTangent");
export const tubeJoinBevel = getSymbol("tubeJoinBevel");
export const tubeJoinMiter = getSymbol("tubeJoinMiter");
export const tubeJoinRound = getSymbol("tubeJoinRound");
//# sourceMappingURL=tube.wgsl.js.map
