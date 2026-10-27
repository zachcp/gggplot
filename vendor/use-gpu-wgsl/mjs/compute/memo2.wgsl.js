/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../use/array.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getSize getSample setSample memoSample @use-gpu/wgsl/use/array packIndex2 sizeToModulus2 vec2<u32> link u32 void infer(T) compute workgroup_size(8,8) export globalId vec3<u32> builtin(global_invocation_id) infers".split(' '));
const table = {[S]:_([0,"T",1,2,3]),[W]:_([3]),[O]:[{[A]:0,[N]:_(4),[S]:_([5,6]),[K]:[{[N]:_(5),[J]:_(5)},{[N]:_(6),[J]:_(6)}]}],[X]:[{[A]:59,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:_(7),[Z]:_([8])}},{[A]:105,[R]:_(1),[G]:2,[F]:{[N]:_(1),[T]:"T",[Z]:_([8]),[P]:[{[N]:"i",[T]:_(9)}],[I]:_(["T"])}},{[A]:134,[R]:_(2),[G]:2,[F]:{[N]:_(2),[T]:_(10),[Z]:_([8]),[P]:[{[N]:"i",[T]:_(9)},{[N]:"v",[T]:"T",[Z]:_([11])}],[I]:_(["T"]),[H]:[{[N]:"T",[A]:1}]}}],[E]:[{[A]:173,[R]:_(3),[G]:1,[F]:{[N]:_(3),[T]:_(10),[Z]:_([12,13,14]),[P]:[{[N]:_(15),[T]:_(16),[Z]:_([17])}],[I]:_([0,2,1])}}],[_(18)]:_(["T"]),[L]:{[_(0)]:true,[_(1)]:true,[_(2)]:true}};
const data = {
  name: "compute/memo2",
  code: _(["use '",4,"'::{",5,",",6,"};@",8," fn ",0,"()->",7,"{};@infer ",T," T;@",8," fn ",1,"(i:u32)->T;@",8," fn ",2,"(i:u32,@",11,"v:T);@",12," @",13,"@",14," fn ",3,"(@",17,15,":",16,",){let s=",0,"();let x=",7,"(",15,".xy);if(any(x>=s)){return;}let m=",6,"(s);let i=",5,"(x,m);",2,"(i,",1,"(i));}\n"]).join(''),
  hash: 0x11c6684aabc86c,
  table,
  shake: [[59,[0,4]],[91,[1,2,4,3]],[105,[2,4]],[134,[3,4]],[173,[4]]],
  tree: decompressAST([[1,0,58],[1,59,90],[1,32,46],[1,14,42],[1,29,67],[0,39,281],[3,0,8],[3,9,29],[1,20,27],[2,11,21],[3,11,41],[2,57,64],[2,67,81],[2,24,34],[2,16,25],[2,12,21]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/array": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const memoSample = getSymbol("memoSample");
//# sourceMappingURL=memo2.wgsl.js.map
