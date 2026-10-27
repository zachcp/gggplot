/* __WGSL_LOADER_GENERATED */
import {decompressAST, decompressString, symbolDictionary, bindEntryPoint} from "@use-gpu/shader/wgsl";
import m0 from "../../codec/octahedral.wgsl";
import m1 from "../../codec/cubemap.wgsl";
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("getTexture toLayer getQuadsToHemiSample @use-gpu/wgsl/codec/octahedral decodeOctahedral decodeHemiOctahedral wrapOctahedral @use-gpu/wgsl/codec/cubemap encodeCubeMap link vec2<f32> u32 export select".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4,5,6]),[K]:[{[N]:_(4),[J]:_(4)},{[N]:_(5),[J]:_(5)},{[N]:_(6),[J]:_(6)}]},{[A]:0,[N]:_(7),[S]:_([8]),[K]:[{[N]:_(8),[J]:_(8)}]}],[X]:[{[A]:144,[R]:_(0),[G]:2,[F]:{[N]:_(0),[T]:C,[Z]:_([9]),[P]:[{[N]:"u",[T]:_(10)},{[N]:"l",[T]:_(11)}]}}],[E]:[{[A]:240,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:C,[Z]:_([12]),[P]:[{[N]:"u",[T]:_(10)}],[I]:_([1,0])}}],[L]:{[_(0)]:true}};
const data = {
  name: "sample/quads-to-hemi",
  code: _(["use '",3,"'::{",4,",",5,",",6,"};use '",7,"'::{",8,"};@",9," fn ",0,"(u:",10,",l:u32)->",C,";const ",1,":array<u32,6>=array(1,1,0,3,2,2);@",12," fn ",2,"(u:",10,")->",C,"{let h=u.xy*2.0-1.0;let _1=",5,"(h).yzx;if(_1.y<0.0){return 1.0;}let x=",8,"(_1);let h1=",1,"[x.layer];let h2=",13,"((x.layer&1u)+1u,0u,x.layer==2u);let c=x.xy.x*.5+.5;let c1=x.xy.y*.5+.5;let h3=",13,"(c1,",13,"(c1,c1+.5,h2>1u),h2>0u);let h4=",10,"(c,h3);let s=",0,"(h4,h1);return s;};\n"]).join(''),
  hash: 0x137e8aab5c3e52,
  table,
  shake: [[144,[0,2]],[194,[1,2]],[240,[2]]],
  tree: decompressAST([[1,0,92],[1,93,143],[1,51,100],[0,50,96],[2,6,13],[0,40,412],[1,0,7],[2,11,31],[2,71,91],[2,59,72],[2,25,32],[2,178,188]], table[S]),
};

const libs = {"@use-gpu/wgsl/codec/octahedral": m0, "@use-gpu/wgsl/codec/cubemap": m1};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});
export default getSymbol();
export const getQuadsToHemiSample = getSymbol("getQuadsToHemiSample");
//# sourceMappingURL=quads-to-hemi.wgsl.js.map
