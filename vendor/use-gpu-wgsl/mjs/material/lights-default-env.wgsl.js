/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("SH_DIFFUSE SH_SPECULAR getDefaultEnvironment sqr sampleDiffuse sampleSpecular array<vec3<f32>> link export f32 SH_DIFFUSE SH_SPECULAR return".split(' '));
const table = {[S]:_([0,1,2,3,4,5]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:2,[V]:{[N]:_(0),[T]:_(6),[Z]:_([7])}},{[A]:38,[R]:_(1),[G]:2,[V]:{[N]:_(1),[T]:_(6),[Z]:_([7])}}],[E]:[{[A]:77,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([8]),[P]:[{[N]:"u",[T]:D},{[N]:"s",[T]:_(9)},{[N]:"d",[T]:D},{[N]:"d1",[T]:D}],[I]:_([4,5])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "material/lights-default-env",
  code: _(["@",7," var ",0,":",6,";@",7," var ",1,":",6,";@",8," fn ",2,"(u:",D,",s:f32,d:",D,",d1:",D,",)->",C,"{if(s<0.0){",12," ",C,"(",4,"(u),1.0);}",12," ",C,"(",5,"(u,s),1.0);}fn sqr(x:f32)->f32{",12," x*x;}fn ",4,"(r:",D,",)->",D,"{let s=max(",D,"(0.0),",0,"[0]+",0,"[1]*r.y+",0,"[2]*r.z+",0,"[3]*r.x+",0,"[4]*r.y*r.x+",0,"[5]*r.y*r.z+",0,"[6]*(3.0*sqr(r.z)-1.0)+",0,"[7]*r.x*r.z+",0,"[8]*(sqr(r.x)-sqr(r.y)));",12," s;}fn ",5,"(r:",D,",s:f32,)->",D,"{let s1=0.2;let f=clamp(1.0-s/0.336,0.0,1.0);let u=sin(r/s1);let v=cos(r/s1);let r1=normalize(r+(u.x*v.z+u.y*v.x+u.z*v.z*v.x)*s1*f*f);let r2=r1*r1;let s2=max(",D,"(0.0),",1,"[ 0]+",1,"[ 1]*r1.y+",1,"[ 2]*r1.z+",1,"[ 3]*r1.x+",1,"[ 4]*r1.y*r1.x+",1,"[ 5]*r1.y*r1.z+",1,"[ 6]*(3.0*sqr(r1.z)-1.0)+",1,"[ 7]*r1.x*r1.z+",1,"[ 8]*(sqr(r1.x)-sqr(r1.y))+",1,"[ 9]*r1.y*(3*r2.x-r2.y)+",1,"[10]*r1.x*r1.y*r1.z+",1,"[11]*r1.y*(5*r2.z-1)+",1,"[12]*r1.z*(5*r2.z-3)+",1,"[13]*r1.x*(5*r2.z-1)+",1,"[14]*r1.z*(r2.x-r2.y)+",1,"[15]*r1.x*(r2.x-3*r2.y));",12," s2;}\n"]).join(''),
  hash: 0x1e51f34e6bae75,
  table,
  shake: [[0,[0,4,2]],[38,[1,5,2]],[77,[2]],[259,[3,4,2,5]],[290,[4,2]],[569,[5,2]]],
  tree: decompressAST([[1,0,38],[1,38,77],[0,39,221],[1,0,7],[2,11,32],[2,105,118],[2,40,54],[0,26,57],[2,3,6],[0,28,307],[2,3,16],[2,64,74],[2,14,24],[2,18,28],[2,18,28],[2,18,28],[2,22,32],[2,22,32],[2,19,22],[2,14,24],[2,22,32],[2,15,18],[2,9,12],[0,21,715],[2,3,17],[2,218,229],[2,16,27],[2,21,32],[2,21,32],[2,21,32],[2,26,37],[2,26,37],[2,21,24],[2,15,26],[2,26,37],[2,17,20],[2,10,13],[2,11,22],[2,35,46],[2,31,42],[2,32,43],[2,32,43],[2,32,43],[2,33,44]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getDefaultEnvironment = getSymbol("getDefaultEnvironment");
//# sourceMappingURL=lights-default-env.wgsl.js.map
