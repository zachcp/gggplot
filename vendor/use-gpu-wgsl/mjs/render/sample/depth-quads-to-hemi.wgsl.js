/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../codec/octahedral.wgsl";
import m1 from "../../codec/cubemap.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("depthTexture depthSampler getTextureSize getShadowDepth toLayer getDepthQuadsToHemiSample @use-gpu/wgsl/codec/octahedral decodeOctahedral decodeHemiOctahedral wrapOctahedral @use-gpu/wgsl/codec/cubemap encodeCubeMap texture_depth_2d_array link sampler vec2<f32> f32 export select".split(' '));
const table = {[S]:_([0,1,2,3,4,5]),[W]:_([5]),[O]:[{[A]:0,[N]:_(6),[S]:_([7,8,9]),[K]:[{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)},{[N]:_(9),[J]:_(9)}]},{[A]:0,[N]:_(10),[S]:_([11]),[K]:[{[N]:_(11),[J]:_(11)}]}],[X]:[{[A]:144,[R]:_(0),[G]:2,[V]:{[N]:_(0),[T]:_(12),[Z]:_([13])}},{[A]:190,[R]:_(1),[G]:2,[V]:{[N]:_(1),[T]:_(14),[Z]:_([13])}},{[A]:221,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(15),[Z]:_([13])}},{[A]:258,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:_(15),[Z]:_([13])}}],[E]:[{[A]:341,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(16),[Z]:_([17]),[P]:[{[N]:"u",[T]:_(15)}],[I]:_([4,2,0,1,3])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "sample/depth-quads-to-hemi",
  code: _(["use '",6,"'::{",7,",",8,",",9,"};use '",10,"'::{",11,"};@",13," var ",0,":",12,";@",13," var ",1,":",14,";@",13," fn ",2,"()->",15,";@",13," fn ",3,"()->",15,";const ",4,":array<u32,6>=array(1,1,0,3,2,2);@",17," fn ",5,"(u:",15,")->f32{let h=u.xy*2.0-1.0;let _1=",8,"(h).yzx;if(_1.y<0.0){return 1.0;}let x=",11,"(_1);let h1=",4,"[x.layer];let h2=",18,"((x.layer&1u)+1u,0u,x.layer==2u);let s=",2,"();let s1=s.y/2.0;let f=(s-1.0)/s;let _2=(s1-1.0)/s1;let _3=",15,"((x.xy.x*f.x)*.5+.5,",18,"((x.xy.y*f.y)*.5+.5,((x.xy.y+.5)*_2)*.5+.25,h2>0u,),);let h3=_3.x;let c=_3.y;let h4=",18,"(c,",18,"(c,c+.5,h2>1u),h2>0u);let h5=",15,"(h3,h4);let x1=h5*s-.5;let x2=floor(x1);let x3=x1-x2;let x4=x2+1.0;let _4=x4/s;let d=textureGather(",0,",",1,",_4,h1);let s2=mix(mix(d.w,d.z,x3.x),mix(d.x,d.y,x3.x),x3.y,);let s3=",3,"();let m=max(abs(_1.x),max(abs(_1.y),abs(_1.z)));let d1=mix(s3.x,s2,m);return d1;};\n"]).join(''),
  hash: 0x1f53c49a2a774,
  table,
  shake: [[144,[0,5]],[190,[1,5]],[221,[2,5]],[258,[3,5]],[295,[4,5]],[341,[5]]],
  tree: decompressAST([[1,0,92],[1,93,143],[1,51,97],[1,46,77],[1,31,67],[1,37,73],[0,37,83],[2,6,13],[0,40,809],[1,0,7],[2,11,36],[2,70,90],[2,59,72],[2,25,32],[2,69,83],[2,345,357],[2,13,25],[2,81,95]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0, "@use-gpu/wgsl/codec/cubemap": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getDepthQuadsToHemiSample = getSymbol("getDepthQuadsToHemiSample");
//# sourceMappingURL=depth-quads-to-hemi.wgsl.js.map
