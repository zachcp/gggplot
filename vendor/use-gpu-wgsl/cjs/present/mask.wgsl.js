/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getEffect getDirection getValue ramp getSlideMask u32 optional link f32 export optional return getDirection select".split(' '));
const table = {[S]:_([0,1,2,3,4]),[W]:_([4]),[X]:[{[A]:0,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:_(5),[Z]:_([6,7])}},{[A]:48,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([6,7])}},{[A]:117,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:_(8),[Z]:_([6,7])}}],[E]:[{[A]:238,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:C,[Z]:_([9]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C}],[I]:_([0,1,2,3])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "present/mask",
  code: _(["@",6," @",7," fn ",0,"()->u32{",11," 0u;};@",6," @",7," fn ",1,"()->",C,"{",11," ",C,"(0.0);};@",6," @",7," fn ",2,"()->f32{",11," 0.0;};fn ",3,"(x:f32,t:f32,s:f32)->f32{",11," clamp(x*s+mix(-s,1.0,t),0.0,1.0);}@",9," fn ",4,"(c:",C,",u:",C,",s:",C,")->",C,"{let e=",0,"();let d=",1,"();let v=",2,"();var m=1.0;if(e==1u){m=1.0-abs(v);}else if(e==2u){let d1=",1,"();let l=length(d1);let c1=",13,"(s,1.0-s,(d1*v)<=",C,"(0.0));let l1=dot(c1,abs(d1))/(l+1.0e-5);m=",3,"(l1,1.0-abs(v),8.0);}else if(e==3u){m=",13,"(0.0,1.0,abs(v)<1.0);}else{m=",13,"(0.0,1.0,abs(v)<0.5);}var c2=c;if(HAS_ALPHA_TO_COVERAGE){c2=",C,"(c2.xyz,c2.a*m);}else{c2=c2*m;}",11," c2;}\n"]).join(''),
  hash: 0x112af103a92546,
  table,
  shake: [[0,[0,4]],[48,[1,4]],[117,[2,4]],[165,[3,4]],[238,[4]]],
  tree: decompressAST([[4,0,47,0],[1,0,9],[1,10,15],[2,9,18],[4,29,97,1],[1,0,9],[1,10,15],[2,9,21],[4,50,97,2],[1,0,9],[1,10,15],[2,9,17],[0,29,102],[2,3,7],[0,70,562],[1,0,7],[2,11,23],[2,67,76],[2,18,30],[2,21,29],[2,67,79],[2,114,118]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getSlideMask = getSymbol("getSlideMask");
//# sourceMappingURL=mask.wgsl.js.map
