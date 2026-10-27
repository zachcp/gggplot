/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../codec/octahedral.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTargetMapping shCoefficients atlasTexture pmremDiffuseRender sqr @use-gpu/wgsl/codec/octahedral decodeOctahedral vec4<u32> link array<vec4<f32>> <storage> texture_storage_2d<rgba16float,write> void compute workgroup_size(8,8) export globalId vec3<u32> builtin(global_invocation_id) shCoefficients globalId".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([3]),[O]:[{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]}],[X]:[{[A]:57,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(7),[Z]:_([8])}},{[A]:98,[R]:_(1),[G]:2,[V]:{[N]:_(1),[T]:_(9),[Z]:_([8]),[Q]:_(10)}},{[A]:148,[R]:_(2),[G]:2,[V]:{[N]:_(2),[T]:_(11),[Z]:_([8])}}],[E]:[{[A]:209,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(12),[Z]:_([13,14,15]),[P]:[{[N]:_(16),[T]:_(17),[Z]:_([18])}],[I]:_([0,1,4,2])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "pmrem/pmrem-diffuse-render",
  code: _(["use '",5,"'::{",6,"};@",8," fn ",0,"()->",7,"{};@",8," var",10,1,":",9,";@",8," var ",2,":",11,";@",13," @",14,"@",15," fn ",3,"(@",18,16,":",17,",){let m=",0,"();let s=m.zw-m.xy;if(any(",16,".xy>=vec2<u32>(s))){return;}let x=vec2<u32>(",16,".xy);let u=vec2<f32>(x)/vec2<f32>(s-1);let r=",6,"(u*2.0-1.0);let s1=(",1,"[0]+",1,"[1]*r.y+",1,"[2]*r.z+",1,"[3]*r.x+",1,"[4]*r.y*r.x+",1,"[5]*r.y*r.z+",1,"[6]*(3.0*sqr(r.z)-1.0)+",1,"[7]*r.x*r.z+",1,"[8]*(sqr(r.x)-sqr(r.y)));textureStore(",2,",x+m.xy,s1);}fn sqr(x:f32)->f32{return x*x;}\n"]).join(''),
  hash: 0x100b1df2e6ca96,
  table,
  shake: [[57,[0,3]],[98,[1,3]],[148,[2,3]],[209,[3]],[784,[4,3]]],
  tree: decompressAST([[1,0,56],[1,57,97],[1,41,91],[1,50,111],[0,61,636],[3,0,8],[3,9,29],[1,20,27],[2,11,29],[3,19,49],[2,57,73],[2,147,163],[2,36,50],[2,18,32],[2,22,36],[2,22,36],[2,22,36],[2,26,40],[2,26,40],[2,23,26],[2,14,28],[2,26,40],[2,19,22],[2,9,12],[2,24,36],[0,25,56],[2,3,6]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.pmremDiffuseRender = getSymbol("pmremDiffuseRender");
//# sourceMappingURL=pmrem-diffuse-render.wgsl.js.map
