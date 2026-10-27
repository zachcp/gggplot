/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSurface sampleSSAO getOpacity getIndirect getGBufferSSAOSurface infer(T) link vec2<u32> f32 export vec2<f32> infers".split(' '));
const table = {[S]:_(["T",0,1,2,3,4]),[W]:_([4]),[X]:[{[A]:14,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([5])},[Z]:_([6]),[P]:[{[N]:"u",[T]:C},{[N]:"c",[T]:C}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:74,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:C,[Z]:_([6]),[P]:[{[N]:"x",[T]:_(7)}]}},{[A]:118,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(8),[Z]:_([6])}},{[A]:145,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:_(8),[Z]:_([6])}}],[E]:[{[A]:173,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:"T",[Z]:_([9]),[P]:[{[N]:"u",[T]:_(10)},{[N]:"c",[T]:C}],[I]:_(["T",0,1,3,2])}}],[_(11)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "surface/g-buffer-ssao-surface",
  code: _(["@infer ",T," T;@",6," fn ",0,"(u:",C,",c:",C,",)->@",5,"T{};@",6," fn ",1,"(x:",7,")->",C,";@",6," fn ",2,"()->f32;@",6," fn ",3,"()->f32;@",9," fn ",4,"(u:",10,",c:",C,",)->T{var s=",0,"(u,c);let s1=",1,"(",7,"(c.xy));let d=s1.w;let a=length(s.albedo)/1.73;let a1=",D,"(2.0404,4.7951,2.7552)*a+",D,"(-0.3324,-0.6417,0.6903);let i=((a1.x*d-a1.y)*d+a1.z)*d;let t=mix(d,i,",3,"());let a2=mix(1.0,t,",2,"());s.occlusion=",C,"(s1.xyz*2.0-1.0,s.occlusion.w*a2);return s;}\n"]).join(''),
  hash: 0xb18d17429dd61,
  table,
  shake: [[0,[0,1,5]],[14,[1,5]],[74,[2,5]],[118,[3,5]],[145,[4,5]],[173,[5]]],
  tree: decompressAST([[1,0,14],[1,14,73],[1,60,103],[1,44,70],[1,27,54],[0,28,417],[1,0,7],[2,11,32],[2,49,50],[2,8,18],[2,23,33],[2,187,198],[2,32,42]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getGBufferSSAOSurface = getSymbol("getGBufferSSAOSurface");
//# sourceMappingURL=g-buffer-ssao-surface.wgsl.js.map
