/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../debug/print.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("data positions colors segments printPoint printLine printData @use-gpu/wgsl/debug/print PrintData link <storage,read_write> array<vec4<f32>> array<i32> void export var<storage,read_write> positions colors segments export atomicAdd".split(' '));
const table = {[S]:_([0,1,2,3,4,5,6]),[W]:_([4,5,6]),[O]:[{[A]:0,[N]:_(7),[S]:_([8]),[K]:[{[N]:_(8),[J]:_(8)}]}],[X]:[{[A]:45,[R]:_(0),[G]:2,[V]:{[N]:_(0),[T]:_(8),[Z]:_([9]),[Q]:_(10)}},{[A]:89,[R]:_(1),[G]:2,[V]:{[N]:_(1),[T]:_(11),[Z]:_([9]),[Q]:_(10)}},{[A]:145,[R]:_(2),[G]:2,[V]:{[N]:_(2),[T]:_(11),[Z]:_([9]),[Q]:_(10)}},{[A]:198,[R]:_(3),[G]:2,[V]:{[N]:_(3),[T]:_(12),[Z]:_([9]),[Q]:_(10)}}],[E]:[{[A]:247,[R]:_(4),[G]:1,[F]:{[N]:_(4),[T]:_(13),[Z]:_([14]),[P]:[{[N]:"p",[T]:C},{[N]:"c",[T]:C}],[I]:_([0,1,2,3])}},{[A]:369,[R]:_(5),[G]:1,[F]:{[N]:_(5),[T]:_(13),[Z]:_([14]),[P]:[{[N]:"s",[T]:C},{[N]:"e",[T]:C},{[N]:"c",[T]:C}],[I]:_([0,1,2,3])}},{[A]:549,[R]:_(6),[G]:1,[F]:{[N]:_(6),[T]:_(13),[Z]:_([14]),[P]:[{[N]:"v",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true,[_(3)]:true}};
const data = {
  name: "debug/print-helper",
  code: _(["use '",7,"'::{",8,"};@",9," var",10,0,":",8,";@",9," var",10,1,":",11,";@",9," var",10,2,":",11,";@",9," var",10,3,":",12,";@",14," fn ",4,"(p:",C,",c:",C,"){let i=",20,"(&",0,".vertex,1u);",1,"[i]=p;",2,"[i]=c;",3,"[i]=0;}@",14," fn ",5,"(s:",C,",e:",C,",c:",C,"){let i=",20,"(&",0,".vertex,2u);",1,"[i]=s;",1,"[i+1]=e;",2,"[i]=c;",2,"[i+1]=c;",3,"[i]=1;",3,"[i+1]=2;}@",14," fn ",6,"(v:",C,"){let i=",20,"(&",0,".vector,1u);",0,".vectors[i]=v;}\n"]).join(''),
  hash: 0x1feb296198795d,
  table,
  shake: [[45,[0,4,5,6]],[89,[1,4,5]],[145,[2,4,5]],[198,[3,4,5]],[247,[4]],[369,[5]],[549,[6]]],
  tree: decompressAST([[1,0,44],[1,45,89],[1,44,100],[1,56,109],[1,53,102],[0,49,171],[1,0,7],[2,11,21],[2,53,57],[2,16,25],[2,15,21],[2,12,20],[0,15,195],[1,0,7],[2,11,20],[2,64,68],[2,16,25],[2,15,24],[2,17,23],[2,12,18],[2,14,22],[2,14,22],[0,17,103],[1,0,7],[2,11,20],[2,40,44],[2,16,20]], table[S]),
};

const libs = {"@use-gpu/wgsl/debug/print": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const printPoint = getSymbol("printPoint");
export const printLine = getSymbol("printLine");
export const printData = getSymbol("printData");
//# sourceMappingURL=print-helper.wgsl.js.map
