/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../../use/types.wgsl");
const m1 = require("../../use/view.wgsl");
const m2 = require("../../geometry/quad.wgsl");
const m3 = require("../../geometry/strip.wgsl");
const m4 = require("../../geometry/line.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getVertex getInstanceSize getWireframeListVertex @use-gpu/wgsl/use/types SolidVertex @use-gpu/wgsl/use/view getViewPixelRatio @use-gpu/wgsl/geometry/quad getQuadIndex @use-gpu/wgsl/geometry/strip getStripIndex @use-gpu/wgsl/geometry/line getLineJoin link u32 export SolidVertex geometry getLineJoin getVertex position".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]},{[A]:0,[N]:_(5),[S]:_([6]),[K]:[{[N]:_(6),[J]:_(6)}]},{[A]:0,[N]:_(7),[S]:_([8]),[K]:[{[N]:_(8),[J]:_(8)}]},{[A]:0,[N]:_(9),[S]:_([10]),[K]:[{[N]:_(10),[J]:_(10)}]},{[A]:0,[N]:_(11),[S]:_([12]),[K]:[{[N]:_(12),[J]:_(12)}]}],[X]:[{[A]:246,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(4),[Z]:_([13]),[P]:[{[N]:"v",[T]:_(14)},{[N]:"i",[T]:_(14)}]}},{[A]:293,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(14),[Z]:_([13])}}],[E]:[{[A]:327,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(4),[Z]:_([15]),[P]:[{[N]:"v",[T]:_(14)},{[N]:"i",[T]:_(14)}],[I]:_([1,0])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "wireframe/wireframe-list",
  code: _(["use '",3,"'::{",4,"};use '",5,"'::{",6,"};use '",7,"'::{",8,"};use '",9,"'::{",10,"};use '",11,"'::{",12,"};@",13," fn ",0,"(v:u32,i:u32)->",4,"{};@",13," fn ",1,"()->u32{};@",15," fn ",2,"(v:u32,i:u32)->",4,"{var _1=",10,"(v);var x=vec2<f32>(_1)*2.0-1.0;var n=",1,"();var f=i % n;var _2=i/n;var v1=u32(f)% 3u;var t=u32(f)-v1;var _3:u32;var _4:u32;var _5:u32;if(v1==0u){_3=t;_4=t+1u;_5=t+2u;}else if(v1==1u){_3=t+1u;_4=t+2u;_5=t;}else if(v1==2u){_3=t+2u;_4=t;_5=t+1u;}var a=",0,"(_3,_2);var b=",0,"(_4,_2);var c=",0,"(_5,_2);if(a.",20,".w<0.0||b.",20,".w<0.0||c.",20,".w<0.0){return ",4,"(",C,"(0.0),",C,"(0.0),",C,"(0.0),",C,"(0.0),",C,"(0.0),0u,);}var l=a.",20,".xyz/a.",20,".w;var r=b.",20,".xyz/b.",20,".w;var o=c.",20,".xyz/c.",20,".w;let l1=",6,"()*2.0;var j:",D,";if(_1.x>0u){let a1=(f32(_1.x)-1.0)/2.0;j=",12,"(l,r,o,a1,x.y,l1,3,1);}else{j=",12,"(o,l,r,1.0,x.y,l1,3,1);}return ",4,"(",C,"(j,1.0),",C,"(1.0),",C,"(0.0),",C,"(0.0),",C,"(1.0),0u,);}\n"]).join(''),
  hash: 0x19740c8d02276d,
  table,
  shake: [[246,[0,2]],[293,[1,2]],[327,[2]]],
  tree: decompressAST([[1,0,44],[1,45,94],[1,50,99],[1,50,101],[1,52,100],[1,49,95],[1,47,80],[0,34,963],[1,0,7],[2,11,33],[2,37,48],[2,19,32],[2,51,66],[2,223,232],[2,23,32],[2,23,32],[2,81,92],[2,202,219],[2,81,92],[2,41,52],[2,42,53]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/types": m0, "@use-gpu/wgsl/use/view": m1, "@use-gpu/wgsl/geometry/quad": m2, "@use-gpu/wgsl/geometry/strip": m3, "@use-gpu/wgsl/geometry/line": m4};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getWireframeListVertex = getSymbol("getWireframeListVertex");
//# sourceMappingURL=wireframe-list.wgsl.js.map
