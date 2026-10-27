/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../use/types.wgsl";
import m1 from "../../use/view.wgsl";
import m2 from "../../geometry/quad.wgsl";
import m3 from "../../geometry/strip.wgsl";
import m4 from "../../geometry/line.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex getInstanceSize getWireframeStripVertex @use-gpu/wgsl/use/types SolidVertex @use-gpu/wgsl/use/view getViewPixelRatio @use-gpu/wgsl/geometry/quad getQuadIndex @use-gpu/wgsl/geometry/strip getStripIndex @use-gpu/wgsl/geometry/line getLineJoin link u32 export SolidVertex geometry getLineJoin getVertex position return".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]},{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]},{[A]:0,[N]:_(7),[S]:_([8]),[K]:[{[N]:_(8),[J]:_(8)}]},{[A]:0,[N]:_(9),[S]:_([10]),[K]:[{[N]:_(10),[J]:_(10)}]},{[A]:0,[N]:_(11),[S]:_([12]),[K]:[{[N]:_(12),[J]:_(12)}]}],[X]:[{[A]:246,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(4),[Z]:_([13]),[P]:[{[N]:"v",[T]:_(14)},{[N]:"i",[T]:_(14)}]}},{[A]:293,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(14),[Z]:_([13])}}],[E]:[{[A]:327,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(4),[Z]:_([15]),[P]:[{[N]:"v",[T]:_(14)},{[N]:"i",[T]:_(14)}],[I]:_([1,0])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "wireframe/wireframe-strip",
  code: _(["use '",3,"'::{",4,"};use '",5,"'::{",6,"};use '",7,"'::{",8,"};use '",9,"'::{",10,"};use '",11,"'::{",12,"};@",13," fn ",0,"(v:u32,i:u32)->",4,"{};@",13," fn ",1,"()->u32{};@",15," fn ",2,"(v:u32,i:u32)->",4,"{var _1=",8,"(v);var x=vec2<f32>(_1)*2.0-1.0;var n=",1,"();var f=i % n;var _2=i/n;var s=",10,"(f);var e=s.y;var t=s.x;var a=",0,"(t,_2);var b=",0,"(t+1u+e,_2);var l=a.",20,".xyz/a.",20,".w;var r=b.",20,".xyz/b.",20,".w;if(a.",20,".w<0.0||b.",20,".w<0.0){",21," ",4,"(",C,"(0.0),",C,"(0.0),",C,"(0.0),",C,"(0.0),",C,"(0.0),0u,);}let l1=length(l-r);if(l1==0.0){",21," ",4,"(",C,"(0.0),",C,"(1.0),",C,"(0.0),",C,"(0.0),",C,"(1.0),0u,);}let l2=",6,"()*2.0;var j:",D,";if(_1.x>0u){j=",12,"(l,l,r,0.0,x.y,l2,1,0);}else{j=",12,"(l,r,r,0.0,x.y,l2,2,0);}",21," ",4,"(",C,"(j,1.0),",C,"(1.0),",C,"(0.0),",C,"(0.0),",C,"(1.0),0u,);}\n"]).join(''),
  hash: 0x131c988ec762d,
  table,
  shake: [[246,[0,2]],[293,[1,2]],[327,[2]]],
  tree: decompressAST([[1,0,44],[1,45,94],[1,50,99],[1,50,101],[1,52,100],[1,49,95],[1,47,80],[0,34,863],[1,0,7],[2,11,34],[2,38,49],[2,19,31],[2,50,65],[2,47,60],[2,43,52],[2,22,31],[2,135,146],[2,131,142],[2,100,117],[2,54,65],[2,42,53],[2,42,53]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0, "@use-gpu/wgsl/use/view": m1, "@use-gpu/wgsl/geometry/quad": m2, "@use-gpu/wgsl/geometry/strip": m3, "@use-gpu/wgsl/geometry/line": m4};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getWireframeStripVertex = getSymbol("getWireframeStripVertex");
//# sourceMappingURL=wireframe-strip.wgsl.js.map
