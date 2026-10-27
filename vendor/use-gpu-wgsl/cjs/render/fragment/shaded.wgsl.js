/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSurface getLight getScissor main WithDepth mainWithDepth infer(T) link optional location(0) fragment frontFacing bool builtin(front_facing) fragCoord builtin(position) fragColor fragUV location(1) fragST location(2) fragNormal location(3) fragTangent location(4) fragPosition location(5) fragScissor location(6) export depth f32 builtin(frag_depth) color locals infers getSurface getLight return getScissor builtin frontFacing fragCoord location fragColor fragUV fragST fragNormal fragTangent fragPosition fragScissor WithDepth".split(' '));
const table = {[S]:_(["T",0,1,2,3,4,5]),[W]:_([3,5]),[X]:[{[A]:14,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:{[N]:"T",[Z]:_([6])},[Z]:_([7]),[P]:[{[N]:"c",[T]:C},{[N]:"u",[T]:C},{[N]:"s",[T]:C},{[N]:"n",[T]:C},{[N]:"t",[T]:C},{[N]:"p",[T]:C},{[N]:"c1",[T]:C}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:-1}]}},{[A]:134,[R]:_(1),[G]:6,[F]:{[N]:_(1),[T]:C,[Z]:_([8,7]),[P]:[{[N]:"s",[T]:"T"}],[I]:_(["T"])}},{[A]:195,[R]:_(2),[G]:6,[F]:{[N]:_(2),[T]:C,[Z]:_([8,7]),[P]:[{[N]:"c",[T]:C},{[N]:"s",[T]:C}]}}],[E]:[{[A]:271,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:{[N]:C,[Z]:_([9])},[Z]:_([10]),[P]:[{[N]:_(11),[T]:_(12),[Z]:_([13])},{[N]:_(14),[T]:C,[Z]:_([15])},{[N]:_(16),[T]:C,[Z]:_([9])},{[N]:_(17),[T]:C,[Z]:_([18])},{[N]:_(19),[T]:C,[Z]:_([20])},{[N]:_(21),[T]:C,[Z]:_([22])},{[N]:_(23),[T]:C,[Z]:_([24])},{[N]:_(25),[T]:C,[Z]:_([26])},{[N]:_(27),[T]:C,[Z]:_([28])}],[I]:_([0,1,2])}},{[A]:938,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(4),[Z]:_([10,29]),[P]:[{[N]:_(11),[T]:_(12),[Z]:_([13])},{[N]:_(14),[T]:C,[Z]:_([15])},{[N]:_(16),[T]:C,[Z]:_([9])},{[N]:_(17),[T]:C,[Z]:_([18])},{[N]:_(19),[T]:C,[Z]:_([20])},{[N]:_(21),[T]:C,[Z]:_([22])},{[N]:_(23),[T]:C,[Z]:_([24])},{[N]:_(25),[T]:C,[Z]:_([26])},{[N]:_(27),[T]:C,[Z]:_([28])}],[I]:_([4,0,1,2,4])}}],[_(34)]:[{[A]:861,[R]:_(4),[G]:0,[U]:{[N]:_(4),[M]:[{[N]:_(30),[T]:_(31),[Z]:_([32])},{[N]:_(33),[T]:C,[Z]:_([9])}]}}],[_(35)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "fragment/shaded",
  code: _(["@infer ",T," T;@",7," fn ",0,"(c:",C,",u:",C,",s:",C,",n:",C,",t:",C,",p:",C,",c1:",C,",)->@",6,"T{}@",8," @",7," fn ",1,"(s:T)->",C,"{",38," s.albedo;}@",8," @",7," fn ",2,"(c:",C,",s:",C,")->",C,"{",38," c;}@",10," fn ",3,"(@",13,11,":",12,",@",15,14,":",C,",@",9,16,":",C,",@",18,17,":",C,",@",20,19,":",C,",@",22,21,":",C,",@",24,23,":",C,",@",26,25,":",C,",@",28,27,":",C,",)->@",9,C,"{var n=",21,";if(!",11,"){n=-n;}var o=",16,";let s=",0,"(o,",17,",",19,",n,",23,",",25,",",14,");o=",1,"(s);if(HAS_SCISSOR){o=",2,"(o,",27,");}if(HAS_ALPHA_TO_DISCARD){if(o.a<=0.0){discard;}}",38," o;}",U," ",4,"{@",40,"(frag_",30,")",30,":f32,@",9,33,":",C,",};@",10," @",29," fn ",3,4,"(@",13,11,":",12,",@",15,14,":",C,",@",9,16,":",C,",@",18,17,":",C,",@",20,19,":",C,",@",22,21,":",C,",@",24,23,":",C,",@",26,25,":",C,",@",28,27,":",C,",)->",4,"{var n=",21,";if(!",11,"){n=",C,"(-n.xyz,n.w);}var o=",16,";let s=",0,"(o,",17,",",19,",n,",23,",",25,",",14,");o=",1,"(s);if(HAS_SCISSOR){o=",2,"(o,",27,");}if(HAS_ALPHA_TO_DISCARD){if(o.a<=0.0){discard;}}",38," ",4,"(s.",30,",o);}\n"]).join(''),
  hash: 0x1626a32444732a,
  table,
  shake: [[0,[0,1,4,6,2]],[14,[1,4,6]],[134,[2,4,6]],[195,[3,4,6]],[271,[4]],[861,[5,6]],[938,[6]]],
  tree: decompressAST([[1,0,14],[1,14,134],[4,120,181,2],[1,0,9],[1,10,15],[2,9,17],[2,11,12],[4,31,107,3],[1,0,9],[1,10,15],[2,9,19],[0,57,647],[3,0,9],[2,13,17],[3,5,27],[3,39,57],[3,38,50],[3,32,44],[3,29,41],[3,29,41],[3,33,45],[3,34,46],[3,35,47],[3,37,49],[2,84,94],[2,67,75],[2,30,40],[0,85,161],[2,7,16],[3,10,30],[3,30,42],[0,30,663],[3,0,9],[1,10,17],[2,11,24],[3,14,36],[3,39,57],[3,38,50],[3,32,44],[3,29,41],[3,29,41],[3,33,45],[3,34,46],[3,35,47],[2,37,46],[2,91,101],[2,67,75],[2,30,40],[2,82,91]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.main = getSymbol("main");
exports.mainWithDepth = getSymbol("mainWithDepth");
//# sourceMappingURL=shaded.wgsl.js.map
