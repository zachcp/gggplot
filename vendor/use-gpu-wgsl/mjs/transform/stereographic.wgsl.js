/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTransformMatrix getStereographicBend getStereographicNormalize getStereographicPosition mat4x4<f32> link f32 optional export return".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(4),[Z]:_([5])}},{[A]:43,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(6),[Z]:_([7,5])}},{[A]:103,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(6),[Z]:_([7,5])}}],[E]:[{[A]:168,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([8]),[P]:[{[N]:"p",[T]:C}],[I]:_([1,2,0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "transform/stereographic",
  code: _(["@",5," fn ",0,"()->",4,";@",7," @",5," fn ",1,"()->f32{",9," 0.0;};@",7," @",5," fn ",2,"()->f32{",9," 1.0;};@",8," fn ",3,"(p:",C,")->",C,"{let s=",1,"();let s1=",2,"();let m=",0,"();if(s>0.0001){if(p.z==-1.0){",9," ",C,"(0.0);}let p1=p.xyz;let r=mix(1.0,length(p1),s1);let z=(p1.z+r);let i=1.0/z;let p2=p1.xy*i;var f=s;let m1=mix(p1.xy,p2,f);let o=",D,"(m1,mix(p1.z,r,f));",9," m*",C,"(o,1.0);}",9," m*",C,"(p.xyz,1.0);}\n"]).join(''),
  hash: 0x5ecdc39b10302,
  table,
  shake: [[0,[0,3]],[43,[1,3]],[103,[2,3]],[168,[3]]],
  tree: decompressAST([[1,0,42],[4,43,102,1],[1,0,9],[1,10,15],[2,9,29],[4,41,105,2],[1,0,9],[1,10,15],[2,9,34],[0,46,454],[1,0,7],[2,11,35],[2,55,75],[2,30,55],[2,34,52]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getStereographicPosition = getSymbol("getStereographicPosition");
//# sourceMappingURL=stereographic.wgsl.js.map
