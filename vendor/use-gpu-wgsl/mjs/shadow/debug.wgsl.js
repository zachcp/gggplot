/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../codec/octahedral.wgsl";
import m1 from "../use/types.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getLight getDepth debugShadowMapPosition mapOrtho mapOmni mapHemi mapSpot @use-gpu/wgsl/codec/octahedral decodeOctahedral wrapOctahedral decodeHemiOctahedral @use-gpu/wgsl/use/types Light link f32 vec2<u32> u32 export return mat4x4".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6]),[W]:_([2]),[O]:[{[A]:0,[N]:_(7),[S]:_([8,9,10]),[K]:[{[N]:_(8),[J]:_(8)},{[N]:_(9),[J]:_(9)},{[N]:_(10),[J]:_(10)}]},{[A]:0,[N]:_(11),[S]:_([12]),[K]:[{[N]:_(12),[J]:_(12)}]}],[X]:[{[A]:132,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(12),[Z]:_([13])}},{[A]:159,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(14),[Z]:_([13]),[P]:[{[N]:"x",[T]:_(15)},{[N]:"i",[T]:_(16)},{[N]:"l",[T]:_(16)}]}}],[E]:[{[A]:207,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([17]),[P]:[{[N]:"i",[T]:_(16)}],[I]:_([0,1,3,4,5,6])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "shadow/debug",
  code: _(["use '",7,"'::{",8,",",9,",",10,"};use '",11,"'::{",12,"};@",13," fn ",0,"()->",12,";@",13," fn ",1,"(x:",15,",i:u32,l:u32)->f32;@",17," fn ",2,"(i:u32)->",C,"{let l=",0,"();let k=l.kind;let m=l.matrix;let _1=l.opts.z;let l1=l.shadowMap;let b=l.shadowBlur;let z=l.shadowDepth;let m1=l.shadowUV;let s=(m1.zw-m1.xy)*SHADOW_PAGE;let m2=u32(s.x);let x=i % m2;let y=i/m2;let x1=",15,"(x,y);let u=(vec2<f32>(x1)+.5)/s;let _2=mix(m1.xy,m1.zw,u);let x2=",15,"(_2*SHADOW_PAGE);let d=",1,"(x2,u32(l1),0u);if(k==2){",18," ",3,"(u,d,m);}if(k==3){",18," ",4,"(u,d,m,z,s.x,b);}if(k==4){",18," ",5,"(u,d,m,z);}if(k==5){",18," ",6,"(u,d,m,z,_1);}",18," ",C,"(0.0);}fn ",3,"(u:vec2<f32>,d:f32,m:",19,"<f32>)->",C,"{let l=d-1.0;let o=",C,"(vec2<f32>(u.x,1.0-u.y)*2.0-1.0,l,1.0);let w=m*o;",18," w;}fn ",4,"(u:vec2<f32>,d:f32,m:",19,"<f32>,z:vec2<f32>,s:f32,b:i32)->",C,"{let l=z.y/(d-z.x);let s1=s/(s-(f32(b)*2.0));let _1=",9,"((u*2.0-1.0)*s1);let x=",8,"(_1).yzx;let o=",C,"(x*l,1.0);let w=m*o;",18," w;}fn ",5,"(u:vec2<f32>,d:f32,m:",19,"<f32>,z:vec2<f32>)->",C,"{let l=z.y/(d-z.x);let _1=(u*2.0-1.0);let x=",10,"(_1).yzx;let o=",C,"(x*l,1.0);let w=m*o;",18," w;}fn ",6,"(u:vec2<f32>,d:f32,m:",19,"<f32>,z:vec2<f32>,i:f32)->",C,"{let l=z.y/(d-z.x);let _1=(u*2.0-1.0)/i;let x=",D,"(_1.x,_1.y,-1.0);let o=",C,"(x*l,1.0);let w=m*o;",18," w;}\n"]).join(''),
  hash: 0x1c5a9bfdb8100e,
  table,
  shake: [[132,[0,2]],[159,[1,2]],[207,[2]],[773,[3,2]],[915,[4,2]],[1152,[5,2]],[1336,[6,2]]],
  tree: decompressAST([[1,0,92],[1,93,131],[1,39,65],[1,27,74],[0,48,614],[1,0,7],[2,11,33],[2,47,55],[2,317,325],[2,40,48],[2,33,40],[2,40,47],[2,34,41],[0,44,186],[2,3,11],[0,139,376],[2,3,10],[2,127,141],[2,37,53],[0,70,254],[2,3,10],[2,107,127],[0,74,263],[2,3,10]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0, "@use-gpu/wgsl/use/types": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const debugShadowMapPosition = getSymbol("debugShadowMapPosition");
//# sourceMappingURL=debug.wgsl.js.map
