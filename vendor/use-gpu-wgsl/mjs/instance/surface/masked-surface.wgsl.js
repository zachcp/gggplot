/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getMask getSurface getMaskedSurface f32 optional link vec2<f32> infer(T) export infers".split(' '));
const table = {[S]:_([0,"T",1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(3),[Z]:_([4,5]),[P]:[{[N]:"u",[T]:_(6)}]}},{[A]:72,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:{[N]:"T",[Z]:_([7])},[Z]:_([5]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}}],[E]:[{[A]:191,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:"T",[Z]:_([8]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_(["T",1,0])}}],[_(9)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "surface/masked-surface",
  code: _(["@",4," @",5," fn ",0,"(u:",6,")->f32{return 1.0;};@infer ",T," T;@",5," fn ",1,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->@",7,"T;@",8," fn ",0,"edSurface(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->T{var s1=",1,"(c,u,s,n,t,p,c1);s1.albedo.a*=",0,"(u.xy);return s1;}\n"]).join(''),
  hash: 0x3ac3ea49f777e,
  table,
  shake: [[0,[0,3]],[58,[1,2,3]],[72,[2,3]],[191,[3]]],
  tree: decompressAST([[4,0,57,0],[1,0,9],[1,10,15],[2,9,16],[1,39,53],[1,14,132],[0,119,309],[1,0,7],[2,11,27],[2,105,106],[2,9,19],[2,40,47]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getMaskedSurface = getSymbol("getMaskedSurface");
//# sourceMappingURL=masked-surface.wgsl.js.map
