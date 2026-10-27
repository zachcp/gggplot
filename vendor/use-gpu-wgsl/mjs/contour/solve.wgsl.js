/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("approx3x3 eps orthogonalize3x3 export mat3x4<f32> return orthogonalize3x3".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:D,[Z]:_([3]),[P]:[{[N]:"s",[T]:_(4)}],[I]:_([2])}}]};
const data = {
  name: "contour/solve",
  code: _(["@",3," fn ",0,"(s:",4,")->",D,"{let t=abs(",D,"(s[0][0],s[1][1],s[2][2]));let m=max(t.x,max(t.y,t.z));if(m==t.x){if(t.y>t.z){",5," ",2,"(s,0u,1u,2u);}else{",5," ",2,"(s,0u,2u,1u);}}else if(m==t.y){if(t.x>t.z){",5," ",2,"(s,1u,0u,2u);}else{",5," ",2,"(s,1u,2u,0u);}}else{if(t.x>t.y){",5," ",2,"(s,2u,0u,1u);}else{",5," ",2,"(s,2u,1u,0u);}}}const eps=1.0e-2;fn ",2,"(m:",4,",i:u32,j:u32,k:u32,)->",D,"{var v=m[i];var v1=m[j];var v2=m[k];let _1=1.0/dot(v.xyz,v.xyz);var p=v.xyz*(v.w*_1);v1=v1-v*(dot(v1.xyz,v.xyz)*_1);v2=v2-v*(dot(v2.xyz,v.xyz)*_1);let _2=1.0/dot(v1.xyz,v1.xyz);let _3=1.0/dot(v2.xyz,v2.xyz);if(_2<_3){if(_1/_2>eps){p+=v1.xyz*(v1.w*_2);v2=v2-v1*(dot(v2.xyz,v1.xyz)*_2);let _3=1.0/dot(v2.xyz,v2.xyz);if(_1/_3>eps){p+=v2.xyz*(v2.w*_3);}}}else{if(_1/_3>eps){p+=v2.xyz*(v2.w*_3);v1=v1-v2*(dot(v1.xyz,v2.xyz)*_3);let _2=1.0/dot(v1.xyz,v1.xyz);if(_1/_2>eps){p+=v1.xyz*(v1.w*_2);}}}",5," p;}\n"]).join(''),
  hash: 0x138ea95f958cd,
  table,
  shake: [[0,[0]],[430,[1,2,0]],[447,[2,0]]],
  tree: decompressAST([[0,0,430],[1,0,7],[2,11,20],[2,140,156],[2,42,58],[2,66,82],[2,42,58],[2,55,71],[2,42,58],[0,32,49],[2,6,9],[0,11,575],[2,3,19],[2,287,290],[2,97,100],[2,42,45],[2,97,100]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const approx3x3 = getSymbol("approx3x3");
//# sourceMappingURL=solve.wgsl.js.map
