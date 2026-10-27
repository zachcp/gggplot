/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("XYLayer encodeCubeMap export vec2<f32> layer u32 locals XYLayer select".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[E]:[{[A]:40,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(0),[Z]:_([2]),[P]:[{[N]:"u",[T]:D}],[I]:_([0,0])}}],[_(6)]:[{[A]:0,[R]:_(0),[G]:0,[U]:{[N]:_(0),[M]:[{[N]:"xy",[T]:_(3)},{[N]:_(4),[T]:_(5)}]}}]};
const data = {
  name: "codec/cubemap",
  code: _([U," ",0,"{xy:",3,",",4,":u32,};@",2," fn ",1,"(u:",D,")->",0,"{let a=abs(u);let m=max(a.x,max(a.y,a.z));var f:u32;var _1:",3,";if(m==a.x){f=",8,"(0u,1u,u.x<0.0);_1=",8,"(",3,"(-u.z,-u.y),",3,"(u.z,-u.y),u.x<0.0);}else if(m==a.y){f=",8,"(2u,3u,u.y<0.0);_1=",8,"(",3,"(u.x,u.z),",3,"(u.x,-u.z),u.y<0.0);}else{f=",8,"(4u,5u,u.z<0.0);_1=",8,"(",3,"(u.x,-u.y),",3,"(-u.x,-u.y),u.z<0.0);}return ",0,"(_1/m,f);};\n"]).join(''),
  hash: 0x137895407e85e3,
  table,
  shake: [[0,[0,1]],[40,[1]]],
  tree: decompressAST([[0,0,39],[2,7,14],[0,33,457],[1,0,7],[2,11,24],[2,28,35],[2,368,375]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const encodeCubeMap = getSymbol("encodeCubeMap");
//# sourceMappingURL=cubemap.wgsl.js.map
