/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("applyTransform getParent getSelf getCombinedClip getTransformedClip transformClip intersectClips optional link u32 export applyTransform return getParent transformClip".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6]),[W]:_([3,4]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([7,8]),[P]:[{[N]:"p",[T]:C}]}},{[A]:68,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:C,[Z]:_([8]),[P]:[{[N]:"i",[T]:_(9)}]}},{[A]:105,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:C,[Z]:_([7,8]),[P]:[{[N]:"i",[T]:_(9)}]}}],[E]:[{[A]:185,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:C,[Z]:_([10]),[P]:[{[N]:"i",[T]:_(9)}],[I]:_([5,1,2,6])}},{[A]:309,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:C,[Z]:_([10]),[P]:[{[N]:"i",[T]:_(9)}],[I]:_([5,1])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "layout/clip",
  code: _(["@",7," @",8," fn ",0,"(p:",C,")->",C,"{",12," p;}@",8," fn ",1,"(i:u32)->",C,";@",7," @",8," fn ",2,"(i:u32)->",C,"{",12," ",C,"(0.0,0.0,0.0,0.0);}@",10," fn ",3,"(i:u32)->",C,"{let a=",5,"(",1,"(i));let b=",2,"(i);",12," ",6,"(a,b);}@",10," fn ",4,"(i:u32)->",C,"{",12," ",5,"(",1,"(i));}fn ",5,"(r:",C,")->",C,"{let u=",0,"(",C,"(r.xy,0.5,1.0));let b=",0,"(",C,"(r.zw,0.5,1.0));",12," ",C,"(u.xy,b.xy);}fn ",6,"(a:",C,",b:",C,")->",C,"{",12," ",C,"(max(a.xy,b.xy),min(a.zw,b.zw));}\n"]).join(''),
  hash: 0x76bf42b8608b6,
  table,
  shake: [[0,[0,5,3,4]],[68,[1,3,4]],[105,[2,3]],[185,[3]],[309,[4]],[393,[5,3,4]],[555,[6,3]]],
  tree: decompressAST([[4,0,68,0],[1,0,9],[1,10,15],[2,9,23],[1,49,85],[4,37,117,2],[1,0,9],[1,10,15],[2,9,16],[0,61,185],[1,0,7],[2,11,26],[2,40,53],[2,14,23],[2,20,27],[2,18,32],[0,21,105],[1,0,7],[2,11,29],[2,44,57],[2,14,23],[0,15,177],[2,3,16],[2,44,58],[2,46,60],[0,69,172],[2,3,17]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getCombinedClip = getSymbol("getCombinedClip");
exports.getTransformedClip = getSymbol("getTransformedClip");
//# sourceMappingURL=clip.wgsl.js.map
