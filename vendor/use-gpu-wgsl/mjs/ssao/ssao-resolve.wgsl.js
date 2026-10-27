/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../codec/normal16.wgsl";
import m1 from "./ssao-weight.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTargetNormal getTargetDepth loadNormal16 loadDepth loadSample getOverscanScale getSize getXYJitter EPS getSSAOResolve @use-gpu/wgsl/codec/normal16 decodeNormal16 ./ssao-weight normalWeight depthWeight link vec2<f32> f32 vec4<u32> vec2<u32> export decodeNormal16 normalWeight depthWeight loadNormal16 loadDepth loadSample".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7,8,9]),[W]:_([9]),[O]:[{[A]:0,[N]:_(10),[S]:_([11]),[K]:[{[N]:_(11),[J]:_(11)}]},{[A]:0,[N]:_(12),[S]:_([13,14]),[K]:[{[N]:_(13),[J]:_(13)},{[N]:_(14),[J]:_(14)}]}],[X]:[{[A]:101,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:D,[Z]:_([15]),[P]:[{[N]:"u",[T]:_(16)}]}},{[A]:150,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(17),[Z]:_([15]),[P]:[{[N]:"u",[T]:_(16)}]}},{[A]:192,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(18),[Z]:_([15]),[P]:[{[N]:"x",[T]:_(19)}]}},{[A]:238,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:_(17),[Z]:_([15]),[P]:[{[N]:"x",[T]:_(19)}]}},{[A]:275,[R]:_(4),[G]:2,[F]:{[N]:_(4),[T]:C,[Z]:_([15]),[P]:[{[N]:"x",[T]:_(19)}]}},{[A]:319,[R]:_(5),[G]:2,[F]:{[N]:_(5),[T]:_(16),[Z]:_([15])}},{[A]:358,[R]:_(6),[G]:2,[F]:{[N]:_(6),[T]:_(16),[Z]:_([15])}},{[A]:388,[R]:_(7),[G]:2,[F]:{[N]:_(7),[T]:_(19),[Z]:_([15])}}],[E]:[{[A]:437,[R]:_(9),[G]:1,[F]:{[N]:_(9),[T]:C,[Z]:_([20]),[P]:[{[N]:"t",[T]:_(16)}],[I]:_([5,1,0,6,2,3,8,4])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true,[_(5)]:true,[_(6)]:true,[_(7)]:true}};
const data = {
  name: "ssao/ssao-resolve",
  code: _(["use '",10,"'::{",11,"};use '",12,"'::{",13,",",14,"};@",15," fn ",0,"(u:",16,")->",D,";@",15," fn ",1,"(u:",16,")->f32;@",15," fn ",2,"(x:",19,")->",18,";@",15," fn ",3,"(x:",19,")->f32;@",15," fn ",4,"(x:",19,")->",C,";@",15," fn ",5,"()->",16,";@",15," fn ",6,"()->",16,";@",15," fn ",7,"()->",19,";const EPS=1e-6;@",20," fn ",9,"(t:",16,")->",C,"{let o=mix(",16,"(0.5),t,",5,"());let t1=",1,"(o);let t2=",0,"(o);let s=o*",6,"()-.5;let f=floor(s);let d=s-f;let x=",19,"(s);let x1=x;let x2=x+",19,"(1,0);let x3=x+",19,"(0,1);let x4=x+",19,"(1);let n=",11,"(",2,"(x1));let n1=",11,"(",2,"(x2));let n2=",11,"(",2,"(x3));let n3=",11,"(",2,"(x4));let d1=",3,"(x1);let d2=",3,"(x2);let d3=",3,"(x3);let d4=",3,"(x4);let i=1.0-d;let w=(",13,"(n,t2)*",14,"(d1,t1))*i.x*i.y+EPS;let w1=(",13,"(n1,t2)*",14,"(d2,t1))*d.x*i.y+EPS;let w2=(",13,"(n2,t2)*",14,"(d3,t1))*i.x*d.y+EPS;let w3=(",13,"(n3,t2)*",14,"(d4,t1))*d.x*d.y+EPS;let w4=w+w1+w2+w3;let s1=",4,"(x1);let s2=",4,"(x2);let s3=",4,"(x3);let s4=",4,"(x4);let s5=mat4x4(s1,s2,s3,s4,)*(",C,"(w,w1,w2,w3)/w4);return ",C,"(",D,"(normalize(s5.rgb)*.5+.5),s5.a);}\n"]).join(''),
  hash: 0x1c20f04ea87f62,
  table,
  shake: [[101,[0,9]],[150,[1,9]],[192,[2,9]],[238,[3,9]],[275,[4,9]],[319,[5,9]],[358,[6,9]],[388,[7]],[422,[8,9]],[437,[9]]],
  tree: decompressAST([[1,0,52],[1,53,100],[1,48,96],[1,49,90],[1,42,87],[1,46,82],[1,37,80],[1,44,82],[1,39,68],[1,30,63],[0,34,49],[2,6,9],[0,9,1014],[1,0,7],[2,11,25],[2,66,82],[2,27,41],[2,25,40],[2,27,34],[2,142,156],[2,15,27],[2,25,39],[2,15,27],[2,25,39],[2,15,27],[2,25,39],[2,15,27],[2,25,34],[2,21,30],[2,21,30],[2,21,30],[2,33,45],[2,19,30],[2,28,31],[2,12,24],[2,20,31],[2,28,31],[2,12,24],[2,20,31],[2,28,31],[2,12,24],[2,20,31],[2,28,31],[2,29,39],[2,22,32],[2,22,32],[2,22,32]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/normal16": m0, "./ssao-weight": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getSSAOResolve = getSymbol("getSSAOResolve");
//# sourceMappingURL=ssao-resolve.wgsl.js.map
