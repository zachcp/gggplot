/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getScissorParams getScissorChannel getScissorBias getScissorPlane link i32 f32 export".split(' '));
const table = {[S]:_([0,1,2,3]),[W]:_([3]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([4])}},{[A]:39,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(5),[Z]:_([4])}},{[A]:73,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(6),[Z]:_([4])}}],[E]:[{[A]:104,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([7]),[P]:[{[N]:"v",[T]:C}],[I]:_([0,1,2])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "scissor/scissor-plane",
  code: _(["@",4," fn ",0,"()->",C,";@",4," fn ",1,"()->i32;@",4," fn ",2,"()->f32;@",7," fn ",3,"(v:",C,")->",C,"{let p=",0,"();var c=",1,"();let b=",2,"();let n=p.xyz;let o=p.w+b;var o1=dot(n,v.xyz)+o;var v1=",C,"(1e5);if(c==-1){let n1=abs(n);let m=max(n1.x,max(n1.y,n1.z));if(m==n1.x){c=0;}else if(m==n1.y){c=1;}else{c=2;}}if(c==0){v1.x=o1;}else if(c==1){v1.y=o1;}else if(c==2){v1.z=o1;}else if(c==3){v1.w=o1;}return v1;};\n"]).join(''),
  hash: 0x1993131304b935,
  table,
  shake: [[0,[0,3]],[39,[1,3]],[73,[2,3]],[104,[3]]],
  tree: decompressAST([[1,0,38],[1,39,72],[1,34,64],[0,31,427],[1,0,7],[2,11,26],[2,46,62],[2,25,42],[2,26,40]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getScissorPlane = getSymbol("getScissorPlane");
//# sourceMappingURL=scissor-plane.wgsl.js.map
