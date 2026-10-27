/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("sizeToModulus2 sizeToModulus3 sizeToModulus4 packIndex2 packIndex3 packIndex4 unpackIndex2 unpackIndex3 unpackIndex4 clipIndex2 clipIndex3 clipIndex4 wrapIndex2 wrapIndex3 wrapIndex4 wrapIndex2i wrapIndex3i wrapIndex4i clampIndex2 clampIndex3 clampIndex4 vec2<u32> export vec3<u32> vec4<u32> u32 vec2<i32> vec3<i32> vec4<i32> export return select".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]),[W]:_([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(21),[Z]:_([22]),[P]:[{[N]:"s",[T]:_(21)}]}},{[A]:85,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(23),[Z]:_([22]),[P]:[{[N]:"s",[T]:_(23)}]}},{[A]:188,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(24),[Z]:_([22]),[P]:[{[N]:"s",[T]:_(24)}]}},{[A]:308,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(25),[Z]:_([22]),[P]:[{[N]:"v",[T]:_(21)},{[N]:"m",[T]:_(21)}]}},{[A]:393,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(25),[Z]:_([22]),[P]:[{[N]:"v",[T]:_(23)},{[N]:"m",[T]:_(23)}]}},{[A]:479,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(25),[Z]:_([22]),[P]:[{[N]:"v",[T]:_(24)},{[N]:"m",[T]:_(24)}]}},{[A]:566,[R]:_(6),[G]:1,[F]:{[N]:_(6),[T]:_(21),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(25)},{[N]:"m",[T]:_(21)}]}},{[A]:653,[R]:_(7),[G]:1,[F]:{[N]:_(7),[T]:_(23),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(25)},{[N]:"m",[T]:_(23)}]}},{[A]:741,[R]:_(8),[G]:1,[F]:{[N]:_(8),[T]:_(24),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(25)},{[N]:"m",[T]:_(24)}]}},{[A]:830,[R]:_(9),[G]:1,[F]:{[N]:_(9),[T]:_(21),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(21)},{[N]:"s",[T]:_(21)}]}},{[A]:907,[R]:_(10),[G]:1,[F]:{[N]:_(10),[T]:_(23),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(23)},{[N]:"s",[T]:_(23)}]}},{[A]:984,[R]:_(11),[G]:1,[F]:{[N]:_(11),[T]:_(24),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(24)},{[N]:"s",[T]:_(24)}]}},{[A]:1061,[R]:_(12),[G]:1,[F]:{[N]:_(12),[T]:_(21),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(26)},{[N]:"s",[T]:_(21)}]}},{[A]:1233,[R]:_(13),[G]:1,[F]:{[N]:_(13),[T]:_(23),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(27)},{[N]:"s",[T]:_(23)}]}},{[A]:1405,[R]:_(14),[G]:1,[F]:{[N]:_(14),[T]:_(24),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(28)},{[N]:"s",[T]:_(24)}]}},{[A]:1577,[R]:_(15),[G]:1,[F]:{[N]:_(15),[T]:_(26),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(26)},{[N]:"s",[T]:_(21)}]}},{[A]:1739,[R]:_(16),[G]:1,[F]:{[N]:_(16),[T]:_(27),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(27)},{[N]:"s",[T]:_(23)}]}},{[A]:1901,[R]:_(17),[G]:1,[F]:{[N]:_(17),[T]:_(28),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(28)},{[N]:"s",[T]:_(24)}]}},{[A]:2063,[R]:_(18),[G]:1,[F]:{[N]:_(18),[T]:_(21),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(26)},{[N]:"s",[T]:_(21)}]}},{[A]:2181,[R]:_(19),[G]:1,[F]:{[N]:_(19),[T]:_(23),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(27)},{[N]:"s",[T]:_(23)}]}},{[A]:2299,[R]:_(20),[G]:1,[F]:{[N]:_(20),[T]:_(24),[Z]:_([22]),[P]:[{[N]:"i",[T]:_(28)},{[N]:"s",[T]:_(24)}]}}]};
const data = {
  name: "use/array",
  code: _(["@",22," fn ",0,"(s:",21,")->",21,"{",30," ",21,"(s.x,0xffffffffu);}@",22," fn ",1,"(s:",23,")->",23,"{let s1=s.x*s.y;",30," ",23,"(s.x,s1,0xffffffffu);}@",22," fn ",2,"(s:",24,")->",24,"{let s1=s.x*s.y;let s2=s1*s.z;",30," ",24,"(s.x,s1,s2,0xffffffffu);}@",22," fn ",3,"(v:",21,",m:",21,")->u32{",30," dot(v,",21,"(1u,m.x));}@",22," fn ",4,"(v:",23,",m:",23,")->u32{",30," dot(v,",23,"(1u,m.xy));}@",22," fn ",5,"(v:",24,",m:",24,")->u32{",30," dot(v,",24,"(1u,m.xyz));}@",22," fn un",3,"(i:u32,m:",21,")->",21,"{",30,"(i % m)/",21,"(1u,m.x);}@",22," fn un",4,"(i:u32,m:",23,")->",23,"{",30,"(i % m)/",23,"(1u,m.xy);}@",22," fn un",5,"(i:u32,m:",24,")->",24,"{",30,"(i % m)/",24,"(1u,m.xyz);}@",22," fn ",9,"(i:",21,",s:",21,")->",21,"{",30," min(s-1,i);}@",22," fn ",10,"(i:",23,",s:",23,")->",23,"{",30," min(s-1,i);}@",22," fn ",11,"(i:",24,",s:",24,")->",24,"{",30," min(s-1,i);}@",22," fn ",12,"(i:",26,",s:",21,")->",21,"{let s1=",26,"(s);var s2=i;s2=",31,"(s2,s2+s1,s2<",26,"(0));s2=",31,"(s2,s2-s1,s2>=s1);",30," ",21,"(s2);}@",22," fn ",13,"(i:",27,",s:",23,")->",23,"{let s1=",27,"(s);var s2=i;s2=",31,"(s2,s2+s1,s2<",27,"(0));s2=",31,"(s2,s2-s1,s2>=s1);",30," ",23,"(s2);}@",22," fn ",14,"(i:",28,",s:",24,")->",24,"{let s1=",28,"(s);var s2=i;s2=",31,"(s2,s2+s1,s2<",28,"(0));s2=",31,"(s2,s2-s1,s2>=s1);",30," ",24,"(s2);}@",22," fn ",12,"i(i:",26,",s:",21,")->",26,"{let s1=",26,"(s);var s2=i;s2=",31,"(s2,s2+s1,s2<",26,"(0));s2=",31,"(s2,s2-s1,s2>=s1);",30," s2;}@",22," fn ",13,"i(i:",27,",s:",23,")->",27,"{let s1=",27,"(s);var s2=i;s2=",31,"(s2,s2+s1,s2<",27,"(0));s2=",31,"(s2,s2-s1,s2>=s1);",30," s2;}@",22," fn ",14,"i(i:",28,",s:",24,")->",28,"{let s1=",28,"(s);var s2=i;s2=",31,"(s2,s2+s1,s2<",28,"(0));s2=",31,"(s2,s2-s1,s2>=s1);",30," s2;}@",22," fn ",18,"(i:",26,",s:",21,")->",21,"{",30," ",21,"(max(",26,"(0),min(",26,"(s)-1,i)));}@",22," fn ",19,"(i:",27,",s:",23,")->",23,"{",30," ",23,"(max(",27,"(0),min(",27,"(s)-1,i)));}@",22," fn ",20,"(i:",28,",s:",24,")->",24,"{",30," ",24,"(max(",28,"(0),min(",28,"(s)-1,i)));}\n"]).join(''),
  hash: 0xae5a4c14052d,
  table,
  shake: [[0,[0]],[85,[1]],[188,[2]],[308,[3]],[393,[4]],[479,[5]],[566,[6]],[653,[7]],[741,[8]],[830,[9]],[907,[10]],[984,[11]],[1061,[12]],[1233,[13]],[1405,[14]],[1577,[15]],[1739,[16]],[1901,[17]],[2063,[18]],[2181,[19]],[2299,[20]]],
  tree: decompressAST([[0,0,85],[1,0,7],[2,11,25],[0,74,177],[1,0,7],[2,11,25],[0,92,212],[1,0,7],[2,11,25],[0,109,194],[1,0,7],[2,11,21],[0,74,160],[1,0,7],[2,11,21],[0,75,162],[1,0,7],[2,11,21],[0,76,163],[1,0,7],[2,11,23],[0,76,164],[1,0,7],[2,11,23],[0,77,166],[1,0,7],[2,11,23],[0,78,155],[1,0,7],[2,11,21],[0,66,143],[1,0,7],[2,11,21],[0,66,143],[1,0,7],[2,11,21],[0,66,238],[1,0,7],[2,11,21],[0,161,333],[1,0,7],[2,11,21],[0,161,333],[1,0,7],[2,11,21],[0,161,323],[1,0,7],[2,11,22],[0,151,313],[1,0,7],[2,11,22],[0,151,313],[1,0,7],[2,11,22],[0,151,269],[1,0,7],[2,11,22],[0,107,225],[1,0,7],[2,11,22],[0,107,225],[1,0,7],[2,11,22]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.sizeToModulus2 = getSymbol("sizeToModulus2");
exports.sizeToModulus3 = getSymbol("sizeToModulus3");
exports.sizeToModulus4 = getSymbol("sizeToModulus4");
exports.packIndex2 = getSymbol("packIndex2");
exports.packIndex3 = getSymbol("packIndex3");
exports.packIndex4 = getSymbol("packIndex4");
exports.unpackIndex2 = getSymbol("unpackIndex2");
exports.unpackIndex3 = getSymbol("unpackIndex3");
exports.unpackIndex4 = getSymbol("unpackIndex4");
exports.clipIndex2 = getSymbol("clipIndex2");
exports.clipIndex3 = getSymbol("clipIndex3");
exports.clipIndex4 = getSymbol("clipIndex4");
exports.wrapIndex2 = getSymbol("wrapIndex2");
exports.wrapIndex3 = getSymbol("wrapIndex3");
exports.wrapIndex4 = getSymbol("wrapIndex4");
exports.wrapIndex2i = getSymbol("wrapIndex2i");
exports.wrapIndex3i = getSymbol("wrapIndex3i");
exports.wrapIndex4i = getSymbol("wrapIndex4i");
exports.clampIndex2 = getSymbol("clampIndex2");
exports.clampIndex3 = getSymbol("clampIndex3");
exports.clampIndex4 = getSymbol("clampIndex4");
//# sourceMappingURL=array.wgsl.js.map
