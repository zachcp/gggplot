/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../codec/octahedral.wgsl");
const m1 = require("../../codec/cubemap.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("depthTexture depthSampler getTextureSize getShadowDepth getBorderScale getDepthCubeToOmniSample @use-gpu/wgsl/codec/octahedral decodeOctahedral wrapOctahedral @use-gpu/wgsl/codec/cubemap encodeCubeMap texture_depth_2d_array link sampler vec2<f32> optional f32 export".split(' '));
const table = {[S]:_([0,1,2,3,4,5]),[W]:_([5]),[O]:[{[A]:0,[N]:_(6),[S]:_([7,8]),[K]:[{[N]:_(7),[J]:_(7)},{[N]:_(8),[J]:_(8)}]},{[A]:0,[N]:_(9),[S]:_([10]),[K]:[{[N]:_(10),[J]:_(10)}]}],[X]:[{[A]:123,[R]:_(0),[G]:2,[V]:{[N]:_(0),[T]:_(11),[Z]:_([12])}},{[A]:169,[R]:_(1),[G]:2,[V]:{[N]:_(1),[T]:_(13),[Z]:_([12])}},{[A]:200,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(14),[Z]:_([12])}},{[A]:237,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:_(14),[Z]:_([12])}},{[A]:274,[R]:_(4),[G]:6,[F]:{[N]:_(4),[T]:_(14),[Z]:_([15,12])}}],[E]:[{[A]:345,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(16),[Z]:_([17]),[P]:[{[N]:"u",[T]:_(14)}],[I]:_([4,2,0,1,3])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true}};
const data = {
  name: "sample/depth-cube-to-omni",
  code: _(["use '",6,"'::{",7,",",8,"};use '",9,"'::{",10,"};@",12," var ",0,":",11,";@",12," var ",1,":",13,";@",12," fn ",2,"()->",14,";@",12," fn ",3,"()->",14,";@",15," @",12," fn ",4,"()->",14,"{return ",14,"(1.0);};@",17," fn ",5,"(u:",14,")->f32{let o=",8,"((u.xy*2.0-1.0)*",4,"());let _1:",D,"=",7,"(o).yzx;let x=",10,"(_1);let s=",2,"();let f=(s-1.0)/s;let _2=(x.xy*f)*.5+.5;let x1=_2*s-.5;let x2=floor(x1);let x3=x1-x2;let x4=x2+1.0;let _3=x4/s;let d=textureGather(",0,",",1,",_3,x.layer);let s1=mix(mix(d.w,d.z,x3.x),mix(d.x,d.y,x3.x),x3.y,);let s2=",3,"();let m=max(abs(_1.x),max(abs(_1.y),abs(_1.z)));let d1=mix(s2.x,s1,m);return d1;}\n"]).join(''),
  hash: 0x1ba83b7a36da67,
  table,
  shake: [[123,[0,5]],[169,[1,5]],[200,[2,5]],[237,[3,5]],[274,[4,5]],[345,[5]]],
  tree: decompressAST([[1,0,71],[1,72,122],[1,51,97],[1,46,77],[1,31,67],[1,37,73],[4,37,107,4],[1,0,9],[1,10,15],[2,9,23],[0,52,572],[1,0,7],[2,11,35],[2,49,63],[2,30,44],[2,35,51],[2,30,43],[2,24,38],[2,146,158],[2,13,25],[2,86,100]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0, "@use-gpu/wgsl/codec/cubemap": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getDepthCubeToOmniSample = getSymbol("getDepthCubeToOmniSample");
//# sourceMappingURL=depth-cube-to-omni.wgsl.js.map
