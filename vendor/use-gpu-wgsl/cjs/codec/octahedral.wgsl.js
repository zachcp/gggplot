/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("signNotZero encodeOctahedral decodeOctahedral wrapOctahedral encodeHemiOctahedral decodeHemiOctahedral vec2<f32> export signNotZero return select export".split(' '));
const table = {[S]:_([0,1,2,3,4,5]),[W]:_([1,2,3,4,5]),[E]:[{[A]:108,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(6),[Z]:_([7]),[P]:[{[N]:"v",[T]:D}],[I]:_([0])}},{[A]:265,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:D,[Z]:_([7]),[P]:[{[N]:"o",[T]:_(6)}],[I]:_([0])}},{[A]:449,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(6),[Z]:_([7]),[P]:[{[N]:"o",[T]:_(6)}]}},{[A]:635,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(6),[Z]:_([7]),[P]:[{[N]:"v",[T]:D}]}},{[A]:793,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:D,[Z]:_([7]),[P]:[{[N]:"o",[T]:_(6)}]}}]};
const data = {
  name: "codec/octahedral",
  code: _(["fn ",0,"(x:",6,")->",6,"{let s=sign(x);",9," ",10,"(s,",6,"(1.0,1.0),s==",6,"(0.0));}@",7," fn ",1,"(v:",D,")->",6,"{let l=abs(v.x)+abs(v.y)+abs(v.z);var r=v.xy/l;if(v.z<0.0){r=(1.0-abs(r.yx))*",0,"(r.xy);}",9," r;}@",7," fn ",2,"(o:",6,")->",D,"{var v=",D,"(o.x,o.y,1.0-abs(o.x)-abs(o.y));if(v.z<0.0){v=",D,"((1.0-abs(v.yx))*",0,"(v.xy),v.z);}",9," normalize(v);}@",7," fn ",3,"(o:",6,")->",6,"{var w=o;w=",10,"(w,",6,"(2.0*sign(w.x)-w.x,-w.y),abs(w.x)>1.0);w=",10,"(w,",6,"(-w.x,2.0*sign(w.y)-w.y),abs(w.y)>1.0);",9," w;}@",7," fn ",4,"(v:",D,")->",6,"{let l=abs(v.x)+abs(v.y)+abs(v.z);let r=v.xy/l;let x=(r.x+r.y);let y=(-r.x+r.y);",9," ",6,"(x,y);}@",7," fn ",5,"(o:",6,")->",D,"{let x=(o.x-o.y)*0.5;let y=(o.x+o.y)*0.5;var v=",D,"(x,y,1.0-abs(x)-abs(y));",9," normalize(v);}\n"]).join(''),
  hash: 0x39397f66eb718,
  table,
  shake: [[0,[0,1,2]],[108,[1]],[265,[2]],[449,[3]],[635,[4]],[793,[5]]],
  tree: decompressAST([[0,0,108],[2,3,14],[0,105,262],[1,0,7],[2,11,27],[2,117,128],[0,29,213],[1,0,7],[2,11,27],[2,128,139],[0,45,231],[1,0,7],[2,11,25],[0,175,333],[1,0,7],[2,11,31],[0,147,303],[1,0,7],[2,11,31]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.encodeOctahedral = getSymbol("encodeOctahedral");
exports.decodeOctahedral = getSymbol("decodeOctahedral");
exports.wrapOctahedral = getSymbol("wrapOctahedral");
exports.encodeHemiOctahedral = getSymbol("encodeHemiOctahedral");
exports.decodeHemiOctahedral = getSymbol("decodeHemiOctahedral");
//# sourceMappingURL=octahedral.wgsl.js.map
