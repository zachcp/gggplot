/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../codec/octahedral.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTargetMapping getSourceMapping getSigma getSamples getScratchTexture scratchTexture atlasTexture pmremBlur sqr rotateAxisAngle @use-gpu/wgsl/codec/octahedral encodeOctahedral decodeOctahedral vec4<u32> link f32 i32 vec2<f32> texture_storage_2d<rgba16float,write> void compute workgroup_size(8,8) export globalId vec3<u32> builtin(global_invocation_id) encodeOctahedral getSourceMapping getScratchTexture globalId return BLUR_PASS".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7,8,9]),[W]:_([7]),[O]:[{[A]:0,[N]:_(10),[S]:_([11,12]),[K]:[{[N]:_(11),[J]:_(11)},{[N]:_(12),[J]:_(12)}]}],[X]:[{[A]:74,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(13),[Z]:_([14])}},{[A]:115,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(13),[Z]:_([14])}},{[A]:156,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(15),[Z]:_([14])}},{[A]:183,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:_(16),[Z]:_([14])}},{[A]:212,[R]:_(4),[G]:2,[F]:{[N]:_(4),[T]:C,[Z]:_([14]),[P]:[{[N]:"u",[T]:_(17)},{[N]:"l",[T]:_(15)}]}},{[A]:269,[R]:_(5),[G]:2,[V]:{[N]:_(5),[T]:_(18),[Z]:_([14])}},{[A]:332,[R]:_(6),[G]:2,[V]:{[N]:_(6),[T]:_(18),[Z]:_([14])}}],[E]:[{[A]:393,[R]:_(7),[G]:1,[F]:{[N]:_(7),[T]:_(19),[Z]:_([20,21,22]),[P]:[{[N]:_(23),[T]:_(24),[Z]:_([25])}],[I]:_([0,1,4,2,3,8,6,5])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true,[_(5)]:true,[_(6)]:true}};
const data = {
  name: "pmrem/pmrem-blur",
  code: _(["use '",10,"'::{",11,",",12,"};@",14," fn ",0,"()->",13,"{};@",14," fn ",1,"()->",13,"{};@",14," fn ",2,"()->f32{};@",14," fn ",3,"()->i32{};@",14," fn ",4,"(u:",17,",l:f32)->",C,";@",14," var ",5,":",18,";@",14," var ",6,":",18,";@",20," @",21,"@",22," fn ",7,"(@",25,23,":",24,",){let m=",0,"();let s=m.zw-m.xy;if(any(",23,".xy>=vec2<u32>(s))){",30,";}let x=vec2<u32>(",23,".xy);let u=",17,"(x)/",17,"(s-1);let _1=(u*2.0-1.0);var s1:",C,";if(",31,"==0){let m=",1,"();let s=m.zw-m.xy;let _2=u*",17,"(s-1)+0.5;s1=",4,"(_2,0.0);}else{let m=",1,"();let s=m.zw-m.xy;let s2=",2,"();let s3=",3,"();var o:",D,";if(",31,"==1){o=",D,"(1.0,0.0,0.0);}if(",31,"==2){o=",D,"(0.0,1.0,0.0);}if(",31,"==3){o=",D,"(0.0,0.0,1.0);}let r=",12,"(u*2.0-1.0);let a=cross(r,o);let p=length(a);let d=SIGMA_CUTOFF/f32(s3-1);let d1=p*s2;var a1:",C,"=",C,"(0.0);var w=0.0;for(var i=0;i<MAX_SAMPLES;i++){if(i>=s3){break;}let f=(f32(i)+.5)*d;let r1=f*d1;let w1=exp(-sqr(f)/2.0);let c=cos(r1);let s4=sin(r1);let c1=cross(r,a)*s4;let d2=mix(a*dot(a,r),r,c);let d3=d2+c1;let d4=d2-c1;let _3=",11,"(d3)*.5+.5;let _4=",11,"(d4)*.5+.5;let _5=_3*",17,"(s-1)+0.5;let _6=_4*",17,"(s-1)+0.5;a1+=w1*",4,"(_5,0.0);a1+=w1*",4,"(_6,0.0);w+=w1*2.0;}s1=a1/w;}if(",31,"==3){textureStore(",6,",x+m.xy,s1);}textureStore(",5,",x,s1);}fn sqr(x:f32)->f32{",30," x*x;}fn ",9,"(v:",D,",k:",D,",t:f32)->",D,"{let c=cos(t);let s=sin(t);",30," v*c+cross(k,v)*s+k*dot(k,v)*(1.0-c);}\n"]).join(''),
  hash: 0xb3fef4fc0f525,
  table,
  shake: [[74,[0,7]],[115,[1,7]],[156,[2,7]],[183,[3,7]],[212,[4,7]],[269,[5,7]],[332,[6,7]],[393,[7]],[1681,[8,7]],[1712,[9]]],
  tree: decompressAST([[1,0,73],[1,74,114],[1,41,81],[1,41,67],[1,27,55],[1,29,85],[1,57,120],[1,63,124],[0,61,1349],[3,0,8],[3,9,29],[1,20,27],[2,11,20],[3,10,40],[2,57,73],[2,200,216],[2,66,83],[2,38,54],[2,42,50],[2,18,28],[2,164,180],[2,236,239],[2,122,138],[2,34,50],[2,92,109],[2,33,50],[2,76,88],[2,38,52],[0,22,53],[2,3,6],[0,28,159],[2,3,18]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const pmremBlur = getSymbol("pmremBlur");
//# sourceMappingURL=pmrem-blur.wgsl.js.map
