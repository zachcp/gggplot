/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSurface sampleSSAO getOpacity getIndirect getSSAOSurface infer(T) link vec2<u32> f32 export infers".split(' '));
const table = {[S]:_(["T",0,1,2,3,4]),[W]:_([4]),[X]:[{[A]:14,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([5])},[Z]:_([6]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:133,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:C,[Z]:_([6]),[P]:[{[N]:"x",[T]:_(7)}]}},{[A]:177,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(8),[Z]:_([6])}},{[A]:204,[R]:_(3),[G]:2,[F]:{[N]:_(3),[T]:_(8),[Z]:_([6])}}],[E]:[{[A]:232,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:"T",[Z]:_([9]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_(["T",0,1,3,2])}}],[_(10)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "surface/ssao-surface",
  code: _(["@infer ",T," T;@",6," fn ",0,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->@",5,"T;@",6," fn ",1,"(x:",7,")->",C,";@",6," fn ",2,"()->f32;@",6," fn ",3,"()->f32;@",9," fn ",4,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->T{var s1=",0,"(c,u,s,n,t,p,c1);let s2=",1,"(",7,"(c1.xy));let d=s2.w;let a=length(s1.albedo)/1.73;let a1=",D,"(2.0404,4.7951,2.7552)*a+",D,"(-0.3324,-0.6417,0.6903);let i=((a1.x*d-a1.y)*d+a1.z)*d;let t1=mix(d,i,",3,"());let a2=mix(1.0,t1,",2,"());s1.occlusion=",C,"(s2.xyz*2.0-1.0,s1.occlusion.w*a2);return s1;}\n"]).join(''),
  hash: 0xc8c3700846d06,
  table,
  shake: [[0,[0,1,5]],[14,[1,5]],[133,[2,5]],[177,[3,5]],[204,[4,5]],[232,[5]]],
  tree: decompressAST([[1,0,14],[1,14,132],[1,119,162],[1,44,70],[1,27,54],[0,28,490],[1,0,7],[2,11,25],[2,103,104],[2,9,19],[2,34,44],[2,190,201],[2,33,43]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getSSAOSurface = getSymbol("getSSAOSurface");
//# sourceMappingURL=ssao-surface.wgsl.js.map
