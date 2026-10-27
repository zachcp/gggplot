/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTransformMatrix getNormalMatrix getMatrixDifferential mat4x4<f32> link u32 mat3x3<f32> export bool".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[X]:[{[A]:0,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(3),[Z]:_([4]),[P]:[{[N]:"i",[T]:_(5)}]}},{[A]:48,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:_(6),[Z]:_([4]),[P]:[{[N]:"i",[T]:_(5)}]}}],[E]:[{[A]:93,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([7]),[P]:[{[N]:"v",[T]:C},{[N]:"o",[T]:C},{[N]:"c",[T]:_(8)}],[I]:_([1,0])}}],[L]:{[_(0)]:true,[_(1)]:true}};
const data = {
  name: "transform/diff-matrix",
  code: _(["@",4," fn ",0,"(i:u32)->",3,";@",4," fn ",1,"(i:u32)->",6,";@",7," fn ",2,"(v:",C,",o:",C,",c:",8,")->",C,"{if(c){return ",C,"(",1,"(0u)*v.xyz,v.w);}let v1=",0,"(0u)*",C,"(v.xyz,0.0);return ",C,"(v1.xyz,v.w);}\n"]).join(''),
  hash: 0x1929a61820d002,
  table,
  shake: [[0,[0,2]],[48,[1,2]],[93,[2]]],
  tree: decompressAST([[1,0,47],[1,48,92],[0,45,257],[1,0,7],[2,11,32],[2,88,103],[2,39,57]], table[S]),
};

const libs = {};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getMatrixDifferential = getSymbol("getMatrixDifferential");
//# sourceMappingURL=diff-matrix.wgsl.js.map
