/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/view.wgsl";
import m1 from "../../use/types.wgsl";
import m2 from "../../geometry/quad.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getFullScreenVertex @use-gpu/wgsl/use/view getViewSize @use-gpu/wgsl/use/types SolidVertex @use-gpu/wgsl/geometry/quad getQuadUV export u32 SolidVertex".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[O]:[{[A]:0,[N]:_(1),[S]:_([2]),[K]:[{[N]:_(2),[J]:_(2)}]},{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]},{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]}],[E]:[{[A]:136,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(4),[Z]:_([7]),[P]:[{[N]:"v",[T]:_(8)},{[N]:"i",[T]:_(8)}]}}]};
const data = {
  name: "vertex/full-screen-view",
  code: _(["use '",1,"'::{",2,"};use '",3,"'::{",4,"};use '",5,"'::{",6,"};@",7," fn ",0,"(v:u32,i:u32)->",4,"{var u=",6,"(v);var x=u*2.0-1.0;",2,"();return ",4,"(",C,"(x.x*2.0+1.0,-(x.y*2.0+1.0),0.5,1.0),",C,"(1.0,1.0,1.0,1.0),",C,"(u*2.0,0.0,0.0),",C,"(0.0),",C,"(1.0),i,);}\n"]).join(''),
  hash: 0x1911ae6f7d8501,
  table,
  shake: [[136,[0]]],
  tree: decompressAST([[1,0,43],[1,44,88],[1,45,91],[0,47,305],[1,0,7],[2,11,30],[2,34,45],[2,18,27],[2,29,40],[2,21,32]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0, "@use-gpu/wgsl/use/types": m1, "@use-gpu/wgsl/geometry/quad": m2};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getFullScreenVertex = getSymbol("getFullScreenVertex");
//# sourceMappingURL=full-screen-view.wgsl.js.map
