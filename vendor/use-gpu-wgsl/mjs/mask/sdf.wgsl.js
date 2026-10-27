/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getUVScale getUVWScale scaleSDF circleSDF diamondSDF squareSDF triangleSDF upSDF downSDF leftSDF rightSDF f32 export vec2<f32> export return length triangleSDF".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6,7,8,9,10]),[W]:_([0,1,2,3,4,5,6,7,8,9,10]),[E]:[{[A]:0,[R]:_(0),[G]:1,[F]:{[N]:_(0),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(13)}]}},{[A]:99,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"u",[T]:D}]}},{[A]:199,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"s",[T]:_(11)},{[N]:"s1",[T]:_(11)}]}},{[A]:311,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(13)}]}},{[A]:388,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(13)}]}},{[A]:476,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(13)}]}},{[A]:566,[R]:_(6),[G]:1,[F]:{[N]:_(6),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(13)}]}},{[A]:715,[R]:_(7),[G]:1,[F]:{[N]:_(7),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(13)}],[I]:_([6])}},{[A]:773,[R]:_(8),[G]:1,[F]:{[N]:_(8),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(13)}],[I]:_([6])}},{[A]:851,[R]:_(9),[G]:1,[F]:{[N]:_(9),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(13)}],[I]:_([6])}},{[A]:928,[R]:_(10),[G]:1,[F]:{[N]:_(10),[T]:_(11),[Z]:_([12]),[P]:[{[N]:"u",[T]:_(13)}],[I]:_([6])}}]};
const data = {
  name: "mask/sdf",
  code: _(["@",12," fn ",0,"(u:",13,")->f32{let d=dpdx(u);let d1=dpdy(u);",15,"(",16,"(d)+",16,"(d1));}@",12," fn ",1,"(u:",D,")->f32{let d=dpdx(u);let d1=dpdy(u);",15,"(",16,"(d)+",16,"(d1));}@",12," fn ",2,"(s:f32,s1:f32)->f32{let d=s/s1+0.5;",15," clamp(d,0.0,1.0)*max(0.0,min(1.0,2.0/s1)*2.0-1.0);}@",12," fn ",3,"(u:",13,")->f32{let x=u*2.0-1.0;",15," 1.0-",16,"(x);}@",12," fn ",4,"(u:",13,")->f32{let x=u*2.0-1.0;",15," 1.0-(abs(x.x)+abs(x.y));}@",12," fn ",5,"(u:",13,")->f32{let x=u*2.0-1.0;",15," 1.0-max(abs(x.x),abs(x.y));}@",12," fn ",6,"(u:",13,")->f32{let x=u*2.0-1.0;let a=x.y-0.5;let b=dot(",13,"(abs(x.x),x.y),",13,"(0.866,-0.5));",15," 1.0-min(a,b);}@",12," fn ",7,"(u:",13,")->f32{",15," ",6,"(u);}@",12," fn ",8,"(u:",13,")->f32{",15," ",6,"(",13,"(u.x,-u.y));}@",12," fn ",9,"(u:",13,")->f32{",15," ",6,"(",13,"(u.y,u.x));}@",12," fn ",10,"(u:",13,")->f32{",15," ",6,"(",13,"(-u.y,u.x));}\n"]).join(''),
  hash: 0x11a98cd148cb22,
  table,
  shake: [[0,[0]],[99,[1]],[199,[2]],[311,[3]],[388,[4]],[476,[5]],[566,[6,7,8,9,10]],[715,[7]],[773,[8]],[851,[9]],[928,[10]]],
  tree: decompressAST([[0,0,99],[1,0,7],[2,11,21],[0,88,188],[1,0,7],[2,11,22],[0,89,201],[1,0,7],[2,11,19],[0,101,178],[1,0,7],[2,11,20],[0,66,154],[1,0,7],[2,11,21],[0,77,167],[1,0,7],[2,11,20],[0,79,228],[1,0,7],[2,11,22],[0,138,196],[1,0,7],[2,11,16],[2,31,42],[0,16,94],[1,0,7],[2,11,18],[2,33,44],[0,34,111],[1,0,7],[2,11,18],[2,33,44],[0,33,112],[1,0,7],[2,11,19],[2,34,45]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getUVScale = getSymbol("getUVScale");
export const getUVWScale = getSymbol("getUVWScale");
export const scaleSDF = getSymbol("scaleSDF");
export const circleSDF = getSymbol("circleSDF");
export const diamondSDF = getSymbol("diamondSDF");
export const squareSDF = getSymbol("squareSDF");
export const triangleSDF = getSymbol("triangleSDF");
export const upSDF = getSymbol("upSDF");
export const downSDF = getSymbol("downSDF");
export const leftSDF = getSymbol("leftSDF");
export const rightSDF = getSymbol("rightSDF");
//# sourceMappingURL=sdf.wgsl.js.map
