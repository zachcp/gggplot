/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/view.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("transformPosition transformDifferential getPosition getOffset getDepth getSize getTangent getBase getTickPosition @use-gpu/wgsl/use/view worldToClip getWorldScale optional link bool u32 f32 export optional return transformDifferential".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7,8]),[W]:_([8]),[O]:[{[A]:0,[N]:_(9),[S]:_([10,11]),[K]:[{[N]:_(10),[J]:_(10)},{[N]:_(11),[J]:_(11)}]}],[X]:[{[A]:58,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([12,13]),[P]:[{[N]:"p",[T]:C}]}},{[A]:130,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([12,13]),[P]:[{[N]:"v",[T]:C},{[N]:"b",[T]:C},{[N]:"c",[T]:_(14)}]}},{[A]:225,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:C,[Z]:_([12,13]),[P]:[{[N]:"i",[T]:_(15)}]}},{[A]:310,[R]:_(3),[G]:6,[F]:{[N]:_(3),[T]:C,[Z]:_([12,13]),[P]:[{[N]:"i",[T]:_(15)}]}},{[A]:381,[R]:_(4),[G]:6,[F]:{[N]:_(4),[T]:_(16),[Z]:_([12,13]),[P]:[{[N]:"i",[T]:_(15)}]}},{[A]:434,[R]:_(5),[G]:6,[F]:{[N]:_(5),[T]:_(16),[Z]:_([12,13]),[P]:[{[N]:"i",[T]:_(15)}]}},{[A]:486,[R]:_(6),[G]:6,[F]:{[N]:_(6),[T]:C,[Z]:_([12,13]),[P]:[{[N]:"i",[T]:_(15)}]}},{[A]:558,[R]:_(7),[G]:6,[F]:{[N]:_(7),[T]:_(16),[Z]:_([12,13]),[P]:[{[N]:"i",[T]:_(15)}]}}],[E]:[{[A]:609,[R]:_(8),[G]:1,[F]:{[N]:_(8),[T]:C,[Z]:_([17]),[P]:[{[N]:"i",[T]:_(15)}],[I]:_([2,3,4,5,6,7,0,1])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true,[_(5)]:true,[_(6)]:true,[_(7)]:true}};
const data = {
  name: "vertex/tick",
  code: _(["use '",9,"'::{",10,",",11,"};@",12," @",13," fn ",0,"(p:",C,")->",C,"{",19," p;};@",12," @",13," fn ",1,"(v:",C,",b:",C,",c:",14,")->",C,"{",19," v;};@",12," @",13," fn ",2,"(i:u32)->",C,"{",19," ",C,"(0.0,0.0,0.0,1.0);};@",12," @",13," fn ",3,"(i:u32)->",C,"{",19," ",C,"(0.0);};@",12," @",13," fn ",4,"(i:u32)->f32{",19," 0.0;};@",12," @",13," fn ",5,"(i:u32)->f32{",19," 5.0;};@",12," @",13," fn ",6,"(i:u32)->",C,"{",19," ",C,"(0.0);};@",12," @",13," fn ",7,"(i:u32)->f32{",19," 2.0;}@",17," fn ",8,"(i:u32)->",C,"{let n=u32(TICK_LINE_DETAIL+1);let v=f32(i % n)/f32(TICK_LINE_DETAIL)-0.5;let _1=i/n;let a=",2,"(_1);let o=",3,"(_1);let d=",4,"(_1);let s=",5,"(_1);let t=",6,"(_1);let b=",7,"(_1);let c=",0,"(a);let c1=",10,"(c);let s1=",11,"(c1.w,d);if(length(t)>0.0){let d1=",1,"(t,a,false).xyz;let l=length(d1)*0.999;let l1=s1*s;let t1=l1/l;let m=u32(round(pow(b,ceil(log(t1)/log(b)))));if((m>1u)&&((_1 % m)!=0u)){",19," ",C,"(0.0,0.0,0.0,0.0);}}let a1=",1,"(o,a,false).xyz;let n1=normalize(a1);",19," c+",C,"(n1*s*v*s1,0.0);}\n"]).join(''),
  hash: 0x13be9abc279004,
  table,
  shake: [[58,[0,8]],[130,[1,8]],[225,[2,8]],[310,[3,8]],[381,[4,8]],[434,[5,8]],[486,[6,8]],[558,[7,8]],[609,[8]]],
  tree: decompressAST([[1,0,57],[4,58,129,0],[1,0,9],[1,10,15],[2,9,26],[4,53,147,1],[1,0,9],[1,10,15],[2,9,30],[4,76,160,2],[1,0,9],[1,10,15],[2,9,20],[4,66,136,3],[1,0,9],[1,10,15],[2,9,18],[4,52,104,4],[1,0,9],[1,10,15],[2,9,17],[4,34,85,5],[1,0,9],[1,10,15],[2,9,16],[4,33,104,6],[1,0,9],[1,10,15],[2,9,19],[4,53,104,7],[1,0,9],[1,10,15],[2,9,16],[0,32,675],[1,0,7],[2,11,26],[2,124,135],[2,22,31],[2,20,28],[2,19,26],[2,18,28],[2,21,28],[2,18,35],[2,28,39],[2,22,35],[2,47,68],[2,200,221]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getTickPosition = getSymbol("getTickPosition");
//# sourceMappingURL=tick.wgsl.js.map
