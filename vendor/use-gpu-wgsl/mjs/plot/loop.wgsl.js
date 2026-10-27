/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("loopSurface vec3<u32> export vec2<i32>".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(1),[Z]:_([2]),[P]:[{[N]:"i",[T]:_(1)},{[N]:"s",[T]:_(1)},{[N]:"o",[T]:_(3)}]}}]};
const data = {
  name: "plot/loop",
  code: _(["@",2," fn ",0,"(i:",1,",s:",1,",o:",3,")->",1,"{var s1=i32(i.x)+o.x;if(LOOP_X){if(s1<0){s1=s1+i32(s.x);}if(s1>=i32(s.x)){s1=s1-i32(s.x);}}else{if(s1<0){s1=0;}if(s1>=i32(s.x)){s1=i32(s.x)-1;}}var s2=i32(i.y)+o.y;if(LOOP_Y){if(s2<0){s2=s2+i32(s.y);}if(s2>=i32(s.y)){s2=s2-i32(s.y);}}else{if(s2<0){s2=0;}if(s2>=i32(s.y)){s2=i32(s.y)-1;}}return ",1,"(u32(s1),u32(s2),i.z);}\n"]).join(''),
  hash: 0xee9b956a3a393,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,396],[1,0,7],[2,11,22]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const loopSurface = getSymbol("loopSurface");
//# sourceMappingURL=loop.wgsl.js.map
