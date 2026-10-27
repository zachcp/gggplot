/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/view.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("SMOOTH_TANGENTS getPosition getAnchor getArcLength getNormal attachArcLabelTo ArcSample ArcPT sampleArc sampleArcPositionTangent @use-gpu/wgsl/use/view getViewResolution worldToClip getWorldScale getViewPosition optional link u32 vec2<u32> f32 export vec2<f32> locals worldToClip optional getPosition return getArcLength ArcSample normalize".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7,8,9]),[W]:_([5]),[O]:[{[A]:0,[N]:_(10),[S]:_([11,12,13,14]),[K]:[{[N]:_(11),[J]:_(11)},{[N]:_(12),[J]:_(12)},{[N]:_(13),[J]:_(13)},{[N]:_(14),[J]:_(14)}]}],[X]:[{[A]:119,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([15,16]),[P]:[{[N]:"i",[T]:_(17)}]}},{[A]:204,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(18),[Z]:_([15,16]),[P]:[{[N]:"i",[T]:_(17)}]}},{[A]:273,[R]:_(3),[G]:6,[F]:{[N]:_(3),[T]:_(19),[Z]:_([15,16]),[P]:[{[N]:"i",[T]:_(17)}]}},{[A]:330,[R]:_(4),[G]:6,[F]:{[N]:_(4),[T]:D,[Z]:_([15,16])}}],[E]:[{[A]:404,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:C,[Z]:_([20]),[P]:[{[N]:"i",[T]:_(17)},{[N]:"s",[T]:_(21)},{[N]:"o",[T]:_(21)},{[N]:"r",[T]:C},{[N]:"x",[T]:_(21)},{[N]:"d",[T]:_(19)},{[N]:"s1",[T]:_(19)},{[N]:"o1",[T]:_(21)},{[N]:"f",[T]:_(21)}],[I]:_([2,3,4,1,8,9])}}],[_(22)]:[{[A]:1046,[R]:_(6),[G]:0,[U]:{[N]:_(6),[M]:[{[N]:"i",[T]:_(17)},{[N]:"f",[T]:_(19)}]}},{[A]:1077,[R]:_(7),[G]:0,[U]:{[N]:_(7),[M]:[{[N]:"p",[T]:D},{[N]:"t",[T]:D}]}}],[L]:{[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true}};
const data = {
  name: "vertex/arc-label",
  code: _(["use '",10,"'::{",11,",",12,",",13,",",14,"};const ",0,"=true;@",15," @",16," fn ",1,"(i:u32)->",C,"{",26," ",C,"(0.0,0.0,0.0,1.0);};@",15," @",16," fn ",2,"(i:u32)->",18,"{",26," ",18,"(0);};@",15," @",16," fn ",3,"(i:u32)->f32{",26," 0.0;};@",15," @",16," fn ",4,"()->",D,"{",26," ",D,"(0.0,1.0,0.0);};@",20," fn ",5,"(i:u32,s:",21,",o:",21,",r:",C,",x:",21,",d:f32,s1:f32,o1:",21,",f:",21,",)->",C,"{let a=",2,"(i);let t=",3,"(a.y);let n=",4,"();let m=",1,"((a.x+a.y)/2);let m1=",1,"((a.x+a.y)/2+1);let c=",12,"(m);let c1=",12,"(m1);var _1=f;if(c.x/c.w>c1.x/c1.w){_1=-_1;}let w=",13,"(c.w,d)*s1;let l=w/max(w*s.x/t,1.0);let c2=mix(r.xy,r.zw,.5);let r1=((c2+o)*l+o1)*_1;let r2=r1.x+t/2.0;let s2=",8,"(a,r2,t);let p=",8,"PositionTangent(a,s2.i,s2.f);let _2=((x+o)*l+o1)*_1;let _3=_2-r1;let b=cross(n,p.t);let w1=p.p+p.t*_3.x+b*_2.y;",26," ",C,"(w1,1.0);};",U," ",6,"{i:u32,f:f32,};",U," ",7,"{p:",D,",t:",D,",};fn ",8,"(a:",18,",a1:f32,t:f32)->",6,"{var s=a.x;var e=a.y;var a2=clamp(a1,0.0,t);for(var i=0;i<8;i++){let m=s+(e-s+1)/2;let v=",3,"(m);if(v>a2){e=m-1;}else{s=m;}if(s==e){break;}}let a3=min(s,a.y-1);let b=a3+1;let l=",3,"(a3);let l1=",3,"(b);let f=(a1-l)/(l1-l);",26," ",6,"(a3,f);}fn ",8,"PositionTangent(a:",18,",i:u32,f:f32)->",7,"{let s=a.x;let e=a.y;let p=",1,"(i).xyz;let p1=",1,"(i+1).xyz;let p2=mix(p,p1,f);var t:",D,";if(",0,"){let l=max(s+1,i)-1;let r=min(e,i+1);let p3=",1,"(l).xyz;let p4=",1,"(r).xyz;let t1=",29,"(p1-p3);let t2=",29,"(p4-p);t=",29,"(mix(t1,t2,f));}else{t=",29,"(p1-p);}",26," ",7,"(p2,t);};\n"]).join(''),
  hash: 0x12076a3bc6b84e,
  table,
  shake: [[92,[0,9,5]],[119,[1,5,9]],[204,[2,5]],[273,[3,5,8]],[330,[4,5]],[404,[5]],[1046,[6,8,5]],[1077,[7,9,5]],[1116,[8,5]],[1434,[9,5]]],
  tree: decompressAST([[1,0,91],[0,92,119],[2,6,21],[4,21,105,1],[1,0,9],[1,10,15],[2,9,20],[4,66,134,2],[1,0,9],[1,10,15],[2,9,18],[4,50,106,3],[1,0,9],[1,10,15],[2,9,21],[4,38,111,4],[1,0,9],[1,10,15],[2,9,18],[0,55,696],[1,0,7],[2,11,27],[2,128,137],[2,19,31],[2,24,33],[2,18,29],[2,32,43],[2,33,44],[2,22,33],[2,61,74],[2,123,132],[2,24,48],[0,147,177],[2,7,16],[0,24,62],[2,7,12],[0,32,350],[2,3,12],[2,37,46],[2,98,110],[2,96,108],[2,24,36],[2,43,52],[0,17,411],[2,3,27],[2,51,56],[2,32,43],[2,26,37],[2,59,74],[2,60,71],[2,26,37],[2,124,129]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.attachArcLabelTo = getSymbol("attachArcLabelTo");
//# sourceMappingURL=arc-label.wgsl.js.map
