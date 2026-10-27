/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../codec/octahedral.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTargetMapping getCubeMap scratchTexture atlasTexture pmremInit @use-gpu/wgsl/codec/octahedral decodeOctahedral vec4<u32> link optional f32 texture_storage_2d<rgba16float,write> void compute workgroup_size(8,8) export globalId vec3<u32> builtin(global_invocation_id) globalId".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([4]),[O]:[{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]}],[X]:[{[A]:57,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(7),[Z]:_([8])}},{[A]:98,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([9,8]),[P]:[{[N]:"u",[T]:D},{[N]:"l",[T]:_(10)}]}},{[A]:182,[R]:_(2),[G]:2,[V]:{[N]:_(2),[T]:_(11),[Z]:_([8])}},{[A]:245,[R]:_(3),[G]:2,[V]:{[N]:_(3),[T]:_(11),[Z]:_([8])}}],[E]:[{[A]:306,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(12),[Z]:_([13,14,15]),[P]:[{[N]:_(16),[T]:_(17),[Z]:_([18])}],[I]:_([0,1,3,2])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "pmrem/pmrem-init",
  code: _(["use '",5,"'::{",6,"};@",8," fn ",0,"()->",7,"{};@",9," @",8," fn ",1,"(u:",D,",l:f32)->",C,"{return ",C,"(0.0);};@",8," var ",2,":",11,";@",8," var ",3,":",11,";@",13," @",14,"@",15," fn ",4,"(@",18,16,":",17,",){let m=",0,"();let s=m.zw-m.xy;if(any(",16,".xy>=vec2<u32>(s))){return;}let x=vec2<u32>(",16,".xy);let u=vec2<f32>(x)/vec2<f32>(s-1);let _1=(u*2.0-1.0);let r=",6,"(_1);let s1=",1,"(r,0.0);textureStore(",3,",x+m.xy,s1);textureStore(",2,",x,s1);}\n"]).join(''),
  hash: 0xbd91ca5a0b9b9,
  table,
  shake: [[57,[0,4]],[98,[1,4]],[182,[2,4]],[245,[3,4]],[306,[4]]],
  tree: decompressAST([[1,0,56],[1,57,97],[4,41,124,1],[1,0,9],[1,10,15],[2,9,19],[1,65,128],[1,63,124],[0,61,452],[3,0,8],[3,9,29],[1,20,27],[2,11,20],[3,10,40],[2,57,73],[2,166,182],[2,28,38],[2,31,43],[2,37,51]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const pmremInit = getSymbol("pmremInit");
//# sourceMappingURL=pmrem-init.wgsl.js.map
