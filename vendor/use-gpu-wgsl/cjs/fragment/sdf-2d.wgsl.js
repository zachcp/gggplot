/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("SDF getUVScale getBoxSDF getBorderBoxSDF getRoundedBorderBoxSDF getBoxCorner getCircleCorner export outer f32 inner vec2<f32> export return length getBoxCorner getCircleCorner".split(' '));
const table = {[Y]:_([0]),[S]:_([0,1,2,3,4,5,6]),[W]:_([0,1,2,3,4]),[E]:[{[A]:0,[R]:_(0),[G]:1,[U]:{[N]:_(0),[Z]:_([7]),[M]:[{[N]:_(8),[T]:_(9)},{[N]:_(10),[T]:_(9)}]}},{[A]:41,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(9),[Z]:_([7]),[P]:[{[N]:"s",[T]:_(11)}]}},{[A]:144,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(0),[Z]:_([7]),[P]:[{[N]:"b",[T]:_(11)},{[N]:"u",[T]:_(11)},{[N]:"s",[T]:_(9)}],[I]:_([0,0])}},{[A]:297,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(0),[Z]:_([7]),[P]:[{[N]:"b",[T]:_(11)},{[N]:"b1",[T]:C},{[N]:"u",[T]:_(11)},{[N]:"s",[T]:_(9)}],[I]:_([0,5,0])}},{[A]:748,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(0),[Z]:_([7]),[P]:[{[N]:"b",[T]:_(11)},{[N]:"b1",[T]:C},{[N]:"r",[T]:C},{[N]:"u",[T]:_(11)},{[N]:"s",[T]:_(9)}],[I]:_([0,6,0])}}]};
const data = {
  name: "fragment/sdf-2d",
  code: _(["@",7," ",U," SDF{",8,":f32,",10,":f32,};@",7," fn ",1,"(s:",11,")->f32{var d=dpdx(s);var d1=dpdy(s);",13,"(",14,"(d)+",14,"(d1))*0.5;}@",7," fn ",2,"(b:",11,",u:",11,",s:f32)->SDF{var n=round(u);var x=(abs(u-.5)-.5)*b;var d=max(x.x,x.y);var o=-d;var o1=o/s;",13," SDF(o1,o1);}@",7," fn ",3,"(b:",11,",b1:",C,",u:",11,",s:f32)->SDF{var n=round(u);var x=(abs(u-.5)-.5)*b;var d=max(x.x,x.y);var o=-d;var f=",C,"(u,1.0-u);var t=f.xy*b;var t1=f.zy*b;var b2=f.xw*b;var b3=f.zw*b;var i=",C,"(",5,"(t,",11,"(b1.x,b1.y)),",5,"(t1,",11,"(b1.z,b1.y)),",5,"(b2,",11,"(b1.x,b1.w)),",5,"(b3,",11,"(b1.z,b1.w)),);var _1=min(min(i.x,i.y),min(i.z,i.w));",13," SDF(o/s,_1/s);}@",7," fn ",4,"(b:",11,",b1:",C,",r:",C,",u:",11,",s:f32)->SDF{var f=",C,"(u,1.0-u);var t=f.xy*b;var t1=f.zy*b;var b2=f.xw*b;var b3=f.zw*b;var o=",C,"(",6,"(t,r.x),",6,"(t1,r.y),",6,"(b2,r.w),",6,"(b3,r.z),);var o1=min(min(o.x,o.y),min(o.z,o.w));t-=b1.xy;t1-=b1.zy;b2-=b1.xw;b3-=b1.zw;var i=max(",C,"(0.0),r-",C,"(max(b1.x,b1.y),max(b1.z,b1.y),max(b1.x,b1.w),max(b1.z,b1.w),));var _1=",C,"(",6,"(t,i.x),",6,"(t1,i.y),",6,"(b2,i.w),",6,"(b3,i.z),);var _2=min(min(_1.x,_1.y),min(_1.z,_1.w));",13," SDF(o1/s,_2/s);}fn ",5,"(x:",11,",o:",11,")->f32{var c=x-o;",13," min(c.x,c.y);}fn ",6,"(x:",11,",r:f32)->f32{var c=max(",11,"(0.0),r-x);var n=min(0.0,max(-x.x,-x.y)+r);",13," r-",14,"(c)-n;}\n"]).join(''),
  hash: 0x2c324c0548d8d,
  table,
  shake: [[0,[0,2,3,4]],[41,[1]],[144,[2]],[297,[3]],[748,[4]],[1392,[5,3]],[1469,[6,4]]],
  tree: decompressAST([[0,0,40],[1,0,7],[2,15,18],[0,26,129],[1,0,7],[2,11,21],[0,92,245],[1,0,7],[2,11,20],[2,42,45],[2,88,91],[0,12,463],[1,0,7],[2,11,26],[2,61,64],[2,166,178],[2,37,49],[2,38,50],[2,38,50],[2,85,88],[0,15,659],[1,0,7],[2,11,33],[2,80,83],[2,100,115],[2,23,38],[2,24,39],[2,24,39],[2,220,235],[2,23,38],[2,24,39],[2,24,39],[2,75,78],[0,16,93],[2,3,15],[0,74,201],[2,3,18]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.SDF = getSymbol("SDF");
exports.getUVScale = getSymbol("getUVScale");
exports.getBoxSDF = getSymbol("getBoxSDF");
exports.getBorderBoxSDF = getSymbol("getBorderBoxSDF");
exports.getRoundedBorderBoxSDF = getSymbol("getRoundedBorderBoxSDF");
//# sourceMappingURL=sdf-2d.wgsl.js.map
