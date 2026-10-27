/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTransformMatrix getSphericalBend getSphericalFocus getSphericalAspectX getSphericalAspectY getSphericalScaleY getSphericalPosition mat4x4<f32> link f32 optional export optional return".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6]),[W]:_([6]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(7),[Z]:_([8])}},{[A]:43,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:_(9),[Z]:_([10,8])}},{[A]:99,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(9),[Z]:_([10,8])}},{[A]:156,[R]:_(3),[G]:6,[F]:{[N]:_(3),[T]:_(9),[Z]:_([10,8])}},{[A]:215,[R]:_(4),[G]:6,[F]:{[N]:_(4),[T]:_(9),[Z]:_([10,8])}},{[A]:274,[R]:_(5),[G]:6,[F]:{[N]:_(5),[T]:_(9),[Z]:_([10,8])}}],[E]:[{[A]:332,[R]:_(6),[G]:1,[F]:{[N]:_(6),[T]:C,[Z]:_([11]),[P]:[{[N]:"p",[T]:C}],[I]:_([1,2,3,4,5,0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true,[_(4)]:true,[_(5)]:true}};
const data = {
  name: "transform/spherical",
  code: _(["@",8," fn ",0,"()->",7,";@",10," @",8," fn ",1,"()->f32{",13," 0.0;};@",10," @",8," fn ",2,"()->f32{",13," 0.0;};@",10," @",8," fn ",3,"()->f32{",13," 1.0;};@",10," @",8," fn ",4,"()->f32{",13," 1.0;};@",10," @",8," fn ",5,"()->f32{",13," 0.0;};@",11," fn ",6,"(p:",C,")->",C,"{let s=",1,"();let s1=",2,"();let s2=",3,"();let s3=",4,"();let s4=",5,"();let m=",0,"();if(s>0.0001){let x=p.xyz*",D,"(s,s/s3*s4,s2);let r=s1+x.z;let c=cos(x.y)*r;",13," m*",C,"(sin(x.x)*c,sin(x.y)*r*s3,(cos(x.x)*c-s1)/s2,1.0);}",13," m*",C,"(p.xyz,1.0);}\n"]).join(''),
  hash: 0x1bab68ed195666,
  table,
  shake: [[0,[0,6]],[43,[1,6]],[99,[2,6]],[156,[3,6]],[215,[4,6]],[274,[5,6]],[332,[6]]],
  tree: decompressAST([[1,0,42],[4,43,98,1],[1,0,9],[1,10,15],[2,9,25],[4,37,93,2],[1,0,9],[1,10,15],[2,9,26],[4,38,96,3],[1,0,9],[1,10,15],[2,9,28],[4,40,98,4],[1,0,9],[1,10,15],[2,9,28],[4,40,97,5],[1,0,9],[1,10,15],[2,9,27],[0,39,439],[1,0,7],[2,11,31],[2,51,67],[2,26,43],[2,27,46],[2,29,48],[2,29,47],[2,27,45]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getSphericalPosition = getSymbol("getSphericalPosition");
//# sourceMappingURL=spherical.wgsl.js.map
