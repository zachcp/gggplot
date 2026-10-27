/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getCubeGridOverlay export".split(' '));
const table = {[S]:_([0]),[W]:_([0]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:C,[Z]:_([1]),[P]:[{[N]:"u",[T]:D}]}}]};
const data = {
  name: "display/cube-grid",
  code: _(["@",1," fn ",0,"(u:",D,")->",C,"{var t=",D,"(0.0,0.0,0.0);let a=abs(u);var b:vec2<f32>;if(a.x>a.y){if(a.x>a.z){b=u.yz/a.x;if(u.x>0.0){t.r+=1.0;}else{t.r+=1.0;t.g+=0.5;}}else{b=u.xy/a.z;if(u.z>0.0){t.b+=1.0;t.g+=0.25;}else{t.b+=1.0;t.r+=0.5;t.g+=0.25;}}}else{if(a.y>a.z){b=u.xz/a.y;if(u.y>0.0){t.g+=1.0;}else{t.g+=1.0;t.b+=0.5;}}else{b=u.xy/a.z;if(u.z>0.0){t.b+=1.0;t.g+=0.25;}else{t.b+=1.0;t.r+=0.5;t.g+=0.25;}}}let b1=clamp(50.0*(max(abs(b.x),abs(b.y))-0.9),0.0,1.0);return ",C,"(t,b1);};\n"]).join(''),
  hash: 0x1dbd821d115e4b,
  table,
  shake: [[0,[0]]],
  tree: decompressAST([[0,0,517],[1,0,7],[2,11,29]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getCubeGridOverlay = getSymbol("getCubeGridOverlay");
//# sourceMappingURL=cube-grid.wgsl.js.map
