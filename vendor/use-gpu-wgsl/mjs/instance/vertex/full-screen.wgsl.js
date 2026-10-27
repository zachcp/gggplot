/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/types.wgsl";
import m1 from "../../geometry/quad.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getFullScreenVertex @use-gpu/wgsl/use/types SolidVertex @use-gpu/wgsl/geometry/quad getQuadUV export u32 SolidVertex".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[O]:[{[A]:0,[N]:_(1),[S]:_([2]),[K]:[{[N]:_(2),[J]:_(2)}]},{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[E]:[{[A]:92,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(2),[Z]:_([5]),[P]:[{[N]:"v",[T]:_(6)},{[N]:"i",[T]:_(6)}]}}]};
const data = {
  name: "vertex/full-screen",
  code: _(["use '",1,"'::{",2,"};use '",3,"'::{",4,"};@",5," fn ",0,"(v:u32,i:u32)->",2,"{var u=",4,"(v);var x=u*2.0-1.0;return ",2,"(",C,"(x.x*2.0+1.0,-(x.y*2.0+1.0),0.5,1.0),",C,"(1.0,1.0,1.0,1.0),",C,"(u*2.0,0.0,0.0),",C,"(0.0),",C,"(1.0),i,);}\n"]).join(''),
  hash: 0xb8604f396ec7,
  table,
  shake: [[92,[0]]],
  tree: decompressAST([[1,0,44],[1,45,91],[0,47,291],[1,0,7],[2,11,30],[2,34,45],[2,18,27],[2,36,47]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0, "@use-gpu/wgsl/geometry/quad": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getFullScreenVertex = getSymbol("getFullScreenVertex");
//# sourceMappingURL=full-screen.wgsl.js.map
