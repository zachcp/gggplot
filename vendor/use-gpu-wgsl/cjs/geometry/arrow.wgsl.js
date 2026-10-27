/* __WGSL_LOADER_GENERATED */
const {decompressAST, decompressString, symbolDictionary, bindEntryPoint} = require("@use-gpu/shader/wgsl");
const m0 = require("../use/view.wgsl");
const {A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z} = symbolDictionary;
const _ = decompressString("ARROW_ASPECT sqr getArrowSize @use-gpu/wgsl/use/view getWorldScale f32 export i32".split(' '));
const table = {[S]:_([0,1,2]),[W]:_([2]),[O]:[{[A]:0,[N]:_(3),[S]:_([4]),[K]:[{[N]:_(4),[J]:_(4)}]}],[E]:[{[A]:105,[R]:_(2),[G]:1,[F]:{[N]:_(2),[T]:_(5),[Z]:_([6]),[P]:[{[N]:"m",[T]:_(5)},{[N]:"w",[T]:_(5)},{[N]:"s",[T]:_(5)},{[N]:"b",[T]:_(7)},{[N]:"w1",[T]:_(5)},{[N]:"d",[T]:_(5)}],[I]:_([0,1])}}]};
const data = {
  name: "geometry/arrow",
  code: _(["use '",3,"'::{",4,"};const ",0,":f32=2.5;fn sqr(f:f32)->f32{return f*f;};@",6," fn ",2,"(m:f32,w:f32,s:f32,b:i32,w1:f32,d:f32)->f32{if(w1<=0.0){return 0.0;}let w2=",4,"(w1,d);let t=s*w*w2*0.5;var m1=m/",0,";if(b>0){m1=m1*0.5;}let r=m1/t;var f=t;if(r<2.0){f=t*(1.0-sqr(1.0-r*0.5));}return f;};\n"]).join(''),
  hash: 0x8e4fe3abdbb18,
  table,
  shake: [[46,[0,2]],[73,[1,2]],[105,[2]]],
  tree: decompressAST([[1,0,45],[0,46,73],[2,6,18],[0,21,52],[2,3,6],[0,29,270],[1,0,7],[2,11,23],[2,87,100],[2,46,58],[2,70,73]], table[S]),
};

const libs = {"@use-gpu/wgsl/use/view": m0};
const getSymbol = (entry) => ({module: bindEntryPoint(data, entry), libs});

const __default = getSymbol();
Object.defineProperty(exports, '__esModule', { value: true });
Object.assign(exports, __default);
exports.default = __default;
    
exports.getArrowSize = getSymbol("getArrowSize");
//# sourceMappingURL=arrow.wgsl.js.map
