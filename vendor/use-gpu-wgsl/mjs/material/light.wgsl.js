/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../use/types.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("applyMaterial applyDirectionalShadow applyPointShadow applyHemiShadow applySpotShadow applyLight @use-gpu/wgsl/use/types Light SurfaceFragment link f32 optional export SurfaceFragment optional return normalize normal shadowMap position select cutoff".split(' '));
const table = {[S]:_([0,1,2,3,4,5]),[W]:_([5]),[O]:[{[A]:0,[N]:_(6),[S]:_([7,8]),[K]:[{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)}]}],[X]:[{[A]:55,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:D,[Z]:_([9]),[P]:[{[N]:"N",[T]:D},{[N]:"L",[T]:D},{[N]:"V",[T]:D},{[N]:"s",[T]:_(8)}]}},{[A]:146,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(10),[Z]:_([11,9]),[P]:[{[N]:"l",[T]:_(7)},{[N]:"s",[T]:_(8)}]}},{[A]:233,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(10),[Z]:_([11,9]),[P]:[{[N]:"l",[T]:_(7)},{[N]:"s",[T]:_(8)}]}},{[A]:314,[R]:_(3),[G]:6,[F]:{[N]:_(3),[T]:_(10),[Z]:_([11,9]),[P]:[{[N]:"l",[T]:_(7)},{[N]:"s",[T]:_(8)}]}},{[A]:394,[R]:_(4),[G]:6,[F]:{[N]:_(4),[T]:_(10),[Z]:_([11,9]),[P]:[{[N]:"l",[T]:_(7)},{[N]:"s",[T]:_(8)}]}}],[E]:[{[A]:474,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:D,[Z]:_([12]),[P]:[{[N]:"N",[T]:D},{[N]:"V",[T]:D},{[N]:"l",[T]:_(7)},{[N]:"s",[T]:_(8)}],[I]:_([1,2,3,4,0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true}};
const data = {
  name: "material/light",
  code: _(["use '",6,"'::{",7,",",8,"};@",9," fn ",0,"(N:",D,",L:",D,",V:",D,",s:",8,",)->",D,"{}@",11," @",9," fn ",1,"(l:",7,",s:",8,",)->f32{",15," 1.0;}@",11," @",9," fn ",2,"(l:",7,",s:",8,",)->f32{",15," 1.0;}@",11," @",9," fn ",3,"(l:",7,",s:",8,",)->f32{",15," 1.0;}@",11," @",9," fn ",4,"(l:",7,",s:",8,",)->f32{",15," 1.0;}@",12," fn ",5,"(N:",D,",V:",D,",l:",7,",s:",8,",)->",D,"{var L:",D,";var i:f32=l.intensity*3.141592;var r:",D,";let k=l.kind;if(k==0){",15,"(s.occlusion.w*l.intensity)*s.albedo.rgb*l.color.rgb;}else if(k==1){L=",16,"(-l.",17,".xyz);let f=clamp(dot(L,N),0.0,1.0);let c=mix(l.opts.rgb,l.color.rgb,f);let b=l.",17,".w;if(b>0.0){L=mix(L,N,b);};r=c*i;}else if(k==2){L=",16,"(-l.",17,".xyz);if(l.",18,">=0){i*=",1,"(l,s);}r=l.color.rgb*i;}else if(k==3){let d=l.",19,".xyz-s.",19,".xyz;L=",16,"(d);var r1=",20,"(i/dot(d,d)-l.",21,",i,l.opts.w>0);if(r1>0.0){if(l.",18,">=0){r1*=",2,"(l,s);}r=l.color.rgb*r1;}else{",15," ",D,"(0.0);}}else if(k==4){let d=l.",19,".xyz-s.",19,".xyz;L=",16,"(d);let f=dot(L,-l.",17,".xyz);var r1=",20,"(i/dot(d,d)-l.",21,",i,l.opts.w>0);if(r1>0.0&&f>=l.opts.x){if(l.",18,">=0){r1*=",3,"(l,s);}let _1=min((f-l.opts.x)*l.opts.y,1.0);r=l.color.rgb*r1*smoothstep(0.0,1.0,_1);}else{",15," ",D,"(0.0);}}else if(k==5){let d=l.",19,".xyz-s.",19,".xyz;L=",16,"(d);let f=dot(L,-l.",17,".xyz);var r1=",20,"(i/dot(d,d)-l.",21,",i,l.opts.w>0);if(r1>0.0&&f>=l.opts.x){if(l.",18,">=0){r1*=",4,"(l,s);}let _1=min((f-l.opts.x)*l.opts.y,1.0);r=l.color.rgb*r1*smoothstep(0.0,1.0,_1);}else{",15," ",D,"(0.0);}}else{",15," ",D,"(0.0);}let d1=r*",0,"(N,L,V,s);",15," d1;}\n"]).join(''),
  hash: 0x13186b2679badd,
  table,
  shake: [[55,[0,5]],[146,[1,5]],[233,[2,5]],[314,[3,5]],[394,[4,5]],[474,[5]]],
  tree: decompressAST([[1,0,54],[1,55,146],[4,91,178,1],[1,0,9],[1,10,15],[2,9,31],[2,25,30],[2,8,23],[4,35,116,2],[1,0,9],[1,10,15],[2,9,25],[2,19,24],[2,8,23],[4,35,115,3],[1,0,9],[1,10,15],[2,9,24],[2,18,23],[2,8,23],[4,35,115,4],[1,0,9],[1,10,15],[2,9,24],[2,18,23],[2,8,23],[0,35,1452],[1,0,7],[2,11,21],[2,37,42],[2,8,23],[2,393,415],[2,193,209],[2,257,272],[2,317,332],[2,167,180]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const applyLight = getSymbol("applyLight");
//# sourceMappingURL=light.wgsl.js.map
