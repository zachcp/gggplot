/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../use/view.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("transformPosition getGridAutoState @use-gpu/wgsl/use/view getViewPosition optional link bool export transformPosition".split(' '));
const table = {[S]:_([0,1]),[W]:_([1]),[O]:[{[A]:0,[N]:_(2),[S]:_([3]),[K]:[{[N]:_(3),[J]:_(3)}]}],[X]:[{[A]:48,[R]:_(0),[G]:6,[F]:{[N]:_(0),[T]:C,[Z]:_([4,5]),[P]:[{[N]:"p",[T]:C}]}}],[E]:[{[A]:120,[R]:_(1),[G]:1,[F]:{[N]:_(1),[T]:_(6),[Z]:_([7]),[P]:[{[N]:"b",[T]:C},{[N]:"s",[T]:C}],[I]:_([0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "plot/grid-auto",
  code: _(["use '",2,"'::{",3,"};@",4," @",5," fn ",0,"(p:",C,")->",C,"{return p;};@",7," fn ",1,"(b:",C,",s:",C,")->",6,"{let v=",3,"().xyz;let p=",0,"(b).xyz;let p1=",0,"(b+s*0.001).xyz;let n=p1-p;let d=dot(v-p,n);return d>0;}\n"]).join(''),
  hash: 0x1a9db0d994b5e7,
  table,
  shake: [[48,[0,1]],[120,[1]]],
  tree: decompressAST([[1,0,47],[4,48,119,0],[1,0,9],[1,10,15],[2,9,26],[0,53,251],[1,0,7],[2,11,27],[2,54,69],[2,28,45],[2,32,49]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getGridAutoState = getSymbol("getGridAutoState");
//# sourceMappingURL=grid-auto.wgsl.js.map
